// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <set>
#include <cmath>
#include <algorithm>

#include <QtCore/QBuffer>
#include <QtCore/QFile>
#include <QtCore/QDir>
#include <QtCore/QCoreApplication>
#include <QtPlugin>
#include <QtGui/QImage>

#include <QtPsdCore/QPsdParser>
#include <QtPsdCore/QPsdLayerRecord>
#include <QtPsdCore/qpsdblend.h>
#include <QtPsdCore/QPsdSectionDividerSetting>

// Import static plugins for WASM
// Additional Layer Information plugins
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationAnnoPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationBlncPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationBritPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationBrstPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationClrlPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationCurvPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationDataPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationExpaPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationFeidPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationFMskPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationGrdmPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationHue2Plugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationLclrPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationLevlPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationLfx2Plugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationLMskPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationLnk_Plugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationLr16Plugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationLrFXPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationLsctPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationLsdkPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationLuniPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationMixrPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationNonePlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationPattPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationPhflPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationPlLdPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationQpointFPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationSelcPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationShmdPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationSoLdPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationTyShPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationU8Plugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationU16Plugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationU32Plugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationUnknownPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationV16DescriptorPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationVmskPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationVogkPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationVscgPlugin)
Q_IMPORT_PLUGIN(QPsdAdditionalLayerInformationVstkPlugin)
// Descriptor plugins
Q_IMPORT_PLUGIN(QPsdDescriptorBoolPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorDoubPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorEnumPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorLongPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorObArPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorObjPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorObjcPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorPthPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorTdtaPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorTextPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorUntFPlugin)
Q_IMPORT_PLUGIN(QPsdDescriptorVlLsPlugin)
// Effects layer plugins
Q_IMPORT_PLUGIN(QPsdEffectsLayerBevlPlugin)
Q_IMPORT_PLUGIN(QPsdEffectsLayerCmnSPlugin)
Q_IMPORT_PLUGIN(QPsdEffectsLayerIglwPlugin)
Q_IMPORT_PLUGIN(QPsdEffectsLayerOglwPlugin)
Q_IMPORT_PLUGIN(QPsdEffectsLayerShadowPlugin)
Q_IMPORT_PLUGIN(QPsdEffectsLayerSofiPlugin)

using namespace emscripten;

// Global Qt application instance (QCoreApplication for Web Worker compatibility)
static int s_argc = 1;
static char* s_argv[] = { (char*)"psddiff_wasm", nullptr };
static QCoreApplication* s_app = nullptr;

// Buffer for receiving data from JavaScript
static QByteArray s_dataBuffer;

void ensureQtApp() {
    if (!s_app) {
        s_app = new QCoreApplication(s_argc, s_argv);
        QDir().mkpath("/tmp");
    }
}

void allocateBuffer(int size) {
    s_dataBuffer.resize(size);
}

val getBufferView() {
    return val(typed_memory_view(s_dataBuffer.size(),
               reinterpret_cast<unsigned char*>(s_dataBuffer.data())));
}

std::string blendModeToString(QPsdBlend::Mode mode) {
    switch (mode) {
        case QPsdBlend::PassThrough: return "passThrough";
        case QPsdBlend::Normal: return "normal";
        case QPsdBlend::Dissolve: return "dissolve";
        case QPsdBlend::Darken: return "darken";
        case QPsdBlend::Multiply: return "multiply";
        case QPsdBlend::ColorBurn: return "colorBurn";
        case QPsdBlend::LinearBurn: return "linearBurn";
        case QPsdBlend::DarkerColor: return "darkerColor";
        case QPsdBlend::Lighten: return "lighten";
        case QPsdBlend::Screen: return "screen";
        case QPsdBlend::ColorDodge: return "colorDodge";
        case QPsdBlend::LinearDodge: return "linearDodge";
        case QPsdBlend::LighterColor: return "lighterColor";
        case QPsdBlend::Overlay: return "overlay";
        case QPsdBlend::SoftLight: return "softLight";
        case QPsdBlend::HardLight: return "hardLight";
        case QPsdBlend::VividLight: return "vividLight";
        case QPsdBlend::LinearLight: return "linearLight";
        case QPsdBlend::PinLight: return "pinLight";
        case QPsdBlend::HardMix: return "hardMix";
        case QPsdBlend::Difference: return "difference";
        case QPsdBlend::Exclusion: return "exclusion";
        case QPsdBlend::Subtract: return "subtract";
        case QPsdBlend::Divide: return "divide";
        case QPsdBlend::Hue: return "hue";
        case QPsdBlend::Saturation: return "saturation";
        case QPsdBlend::Color: return "color";
        case QPsdBlend::Luminosity: return "luminosity";
        default: return "normal";
    }
}

std::string colorModeToString(int mode) {
    switch (mode) {
        case 0: return "Bitmap";
        case 1: return "Grayscale";
        case 2: return "Indexed";
        case 3: return "RGB";
        case 4: return "CMYK";
        case 7: return "Multichannel";
        case 8: return "Duotone";
        case 9: return "Lab";
        default: return "Unknown";
    }
}

// Structure to hold parser data
struct PsdData {
    QPsdParser parser;
    // Cache header info since parser state may change
    int width = 0;
    int height = 0;
    int colorMode = 0;
};

// Simple array-based handle storage (handles are 1-based indices)
// Maximum 16 concurrent parsers should be more than enough
static PsdData* s_parsers[16] = {nullptr};

// Find a free handle slot (reuse released handles)
static int findFreeHandle() {
    for (int i = 1; i < 16; i++) {
        if (s_parsers[i] == nullptr) {
            return i;
        }
    }
    return -1; // No free slots
}

// Blend mode implementations for manual compositing
namespace BlendModes {
    inline int clamp255(int v) { return v < 0 ? 0 : (v > 255 ? 255 : v); }
    inline int multiply(int a, int b) { return (a * b) / 255; }
    inline int screen(int a, int b) { return 255 - multiply(255 - a, 255 - b); }
    inline int overlay(int a, int b) { return a < 128 ? multiply(2 * a, b) : screen(2 * a - 255, b); }
    inline int hardLight(int a, int b) { return b < 128 ? multiply(a, 2 * b) : screen(a, 2 * b - 255); }
    inline int softLight(int a, int b) {
        double aa = a / 255.0, bb = b / 255.0;
        double result = bb < 0.5 ? aa - (1.0 - 2.0 * bb) * aa * (1.0 - aa)
                                  : aa + (2.0 * bb - 1.0) * (aa < 0.25 ? ((16.0 * aa - 12.0) * aa + 4.0) * aa - aa : std::sqrt(aa) - aa);
        return clamp255(static_cast<int>(result * 255.0));
    }
    inline int colorDodge(int a, int b) { return b == 255 ? 255 : clamp255((a * 255) / (255 - b)); }
    inline int colorBurn(int a, int b) { return b == 0 ? 0 : clamp255(255 - ((255 - a) * 255) / b); }
    inline int linearDodge(int a, int b) { return clamp255(a + b); }
    inline int linearBurn(int a, int b) { return clamp255(a + b - 255); }
    inline int darken(int a, int b) { return std::min(a, b); }
    inline int lighten(int a, int b) { return std::max(a, b); }
    inline int difference(int a, int b) { return std::abs(a - b); }
    inline int exclusion(int a, int b) { return a + b - 2 * multiply(a, b); }

    // Apply blend mode to a single channel
    int applyBlend(int dst, int src, QPsdBlend::Mode mode) {
        switch (mode) {
            case QPsdBlend::Normal:
            case QPsdBlend::PassThrough:
                return src;
            case QPsdBlend::Multiply:
                return multiply(dst, src);
            case QPsdBlend::Screen:
                return screen(dst, src);
            case QPsdBlend::Overlay:
                return overlay(dst, src);
            case QPsdBlend::HardLight:
                return hardLight(dst, src);
            case QPsdBlend::SoftLight:
                return softLight(dst, src);
            case QPsdBlend::ColorDodge:
                return colorDodge(dst, src);
            case QPsdBlend::ColorBurn:
                return colorBurn(dst, src);
            case QPsdBlend::LinearDodge:
                return linearDodge(dst, src);
            case QPsdBlend::LinearBurn:
                return linearBurn(dst, src);
            case QPsdBlend::Darken:
                return darken(dst, src);
            case QPsdBlend::Lighten:
                return lighten(dst, src);
            case QPsdBlend::Difference:
                return difference(dst, src);
            case QPsdBlend::Exclusion:
                return exclusion(dst, src);
            default:
                return src; // Default to normal
        }
    }
}

// Composite a source layer onto destination with blend mode and opacity
void compositeLayer(
    std::vector<unsigned char>& dst, int dstWidth, int dstHeight,
    const QImage& srcImage, int srcX, int srcY,
    QPsdBlend::Mode blendMode, double opacity)
{
    if (srcImage.isNull()) return;

    QImage src = srcImage.convertToFormat(QImage::Format_ARGB32);
    int srcWidth = src.width();
    int srcHeight = src.height();

    for (int y = 0; y < srcHeight; ++y) {
        int dstY = srcY + y;
        if (dstY < 0 || dstY >= dstHeight) continue;

        const QRgb* srcLine = reinterpret_cast<const QRgb*>(src.constScanLine(y));
        int dstOffset = (dstY * dstWidth) * 4;

        for (int x = 0; x < srcWidth; ++x) {
            int dstX = srcX + x;
            if (dstX < 0 || dstX >= dstWidth) continue;

            QRgb srcPixel = srcLine[x];
            int srcA = qAlpha(srcPixel);
            if (srcA == 0) continue;

            int srcR = qRed(srcPixel);
            int srcG = qGreen(srcPixel);
            int srcB = qBlue(srcPixel);

            // Apply layer opacity
            double effectiveAlpha = (srcA / 255.0) * opacity;

            int idx = dstOffset + dstX * 4;
            int dstR = dst[idx + 0];
            int dstG = dst[idx + 1];
            int dstB = dst[idx + 2];
            int dstA = dst[idx + 3];

            // Apply blend mode
            int blendR = BlendModes::applyBlend(dstR, srcR, blendMode);
            int blendG = BlendModes::applyBlend(dstG, srcG, blendMode);
            int blendB = BlendModes::applyBlend(dstB, srcB, blendMode);

            // Alpha compositing (Porter-Duff over)
            double srcAlpha = effectiveAlpha;
            double dstAlpha = dstA / 255.0;
            double outAlpha = srcAlpha + dstAlpha * (1.0 - srcAlpha);

            if (outAlpha > 0) {
                dst[idx + 0] = BlendModes::clamp255(static_cast<int>((blendR * srcAlpha + dstR * dstAlpha * (1.0 - srcAlpha)) / outAlpha));
                dst[idx + 1] = BlendModes::clamp255(static_cast<int>((blendG * srcAlpha + dstG * dstAlpha * (1.0 - srcAlpha)) / outAlpha));
                dst[idx + 2] = BlendModes::clamp255(static_cast<int>((blendB * srcAlpha + dstB * dstAlpha * (1.0 - srcAlpha)) / outAlpha));
                dst[idx + 3] = BlendModes::clamp255(static_cast<int>(outAlpha * 255.0));
            }
        }
    }
}

// Parse PSD and return parser handle (integer)
val parsePsd(int dataSize) {
    ensureQtApp();

    val result = val::object();

    if (dataSize <= 0 || dataSize > s_dataBuffer.size()) {
        result.set("error", "Invalid data size");
        return result;
    }

    // Create data structure
    PsdData* psdData = new PsdData();

    // Save to temp file and load
    static int tempFileCounter = 0;
    QString tempPath = QString("/tmp/psd_%1.psd").arg(tempFileCounter++);
    QFile tempFile(tempPath);
    if (!tempFile.open(QIODevice::WriteOnly)) {
        delete psdData;
        result.set("error", std::string("Cannot create temp file: ") + tempPath.toStdString());
        return result;
    }

    tempFile.write(s_dataBuffer.constData(), dataSize);
    tempFile.close();

    psdData->parser.load(tempPath);
    tempFile.remove();

    // Cache header info
    const auto& header = psdData->parser.fileHeader();
    psdData->width = header.width();
    psdData->height = header.height();
    psdData->colorMode = header.colorMode();

    if (psdData->width == 0 || psdData->height == 0) {
        delete psdData;
        result.set("error", "Failed to parse PSD - invalid header");
        return result;
    }

    // Store in handle array and return integer handle (avoids 64-bit pointer precision loss)
    int handle = findFreeHandle();
    if (handle < 0) {
        delete psdData;
        result.set("error", "Too many parsers allocated");
        return result;
    }
    s_parsers[handle] = psdData;
    result.set("handle", handle);
    result.set("width", psdData->width);
    result.set("height", psdData->height);
    result.set("channels", static_cast<int>(header.channels()));
    result.set("depth", static_cast<int>(header.depth()));
    result.set("colorMode", colorModeToString(header.colorMode()));

    // Build layers array from layer records
    val layers = val::array();
    const auto& layerMaskInfo = psdData->parser.layerAndMaskInformation();
    const auto& layerInfo = layerMaskInfo.layerInfo();
    const auto& records = layerInfo.records();

    for (int i = 0; i < records.size(); ++i) {
        const auto& record = records[i];
        val layer = val::object();

        const auto& ali = record.additionalLayerInformation();
        // Use lyid if available, otherwise use index + 1 as fallback ID
        int layerId = ali.value("lyid").toInt();
        if (layerId <= 0) {
            layerId = i + 1;  // Ensure positive ID
        }
        layer.set("id", layerId);
        layer.set("index", i);  // Original index in PSD for rendering

        std::string layerType = "layer";
        const auto& lsct = ali.value("lsct");
        if (lsct.isValid() && lsct.canConvert<QPsdSectionDividerSetting>()) {
            auto sectionDivider = lsct.value<QPsdSectionDividerSetting>();
            int type = sectionDivider.type();
            if (type == 1 || type == 2) {
                layerType = "group";
            } else if (type == 3) {
                layerType = "groupEnd";
            }
        }
        layer.set("type", layerType);

        // Get layer name - same as QPsdLayerTreeItemModel::layerName()
        QString layerName;
        if (ali.contains("luni")) {
            layerName = ali.value("luni").toString();
        } else {
            layerName = QString::fromUtf8(record.name());
        }
        layer.set("name", layerName.toStdString());

        QRect rect = record.rect();
        layer.set("x", rect.x());
        layer.set("y", rect.y());
        layer.set("width", rect.width());
        layer.set("height", rect.height());
        layer.set("visible", !record.isVisible());  // PSD uses inverted flag
        layer.set("opacity", static_cast<int>(record.opacity()));
        layer.set("blendMode", blendModeToString(record.blendMode()));

        layers.call<void>("push", layer);
    }

    result.set("layers", layers);
    return result;
}

// Render composite with visibility overrides using layer records directly
val renderCompositeWithVisibility(double handleD, val hiddenLayerIds, val shownLayerIds) {
    val result = val::object();
    int handle = static_cast<int>(handleD);

    // Debug: dump parser state
    std::string parserState = "Parsers: ";
    for (int i = 1; i < 16; i++) {
        parserState += std::to_string(i) + ":" + (s_parsers[i] ? "Y" : "N") + " ";
    }
    result.set("debug_parserState", parserState);

    try {
        if (handle < 1 || handle >= 16 || s_parsers[handle] == nullptr) {
            result.set("error", std::string("Invalid parser handle: ") + std::to_string(handle) + " | " + parserState);
            return result;
        }
        PsdData* psdData = s_parsers[handle];

        int width = psdData->width;
        int height = psdData->height;

        if (width <= 0 || height <= 0) {
            result.set("error", "Invalid image dimensions");
            return result;
        }

        // Convert JS arrays to sets
        std::set<int> hiddenIds, shownIds;
        int hiddenCount = hiddenLayerIds["length"].as<int>();
        int shownCount = shownLayerIds["length"].as<int>();
        for (int i = 0; i < hiddenCount; i++)
            hiddenIds.insert(hiddenLayerIds[i].as<int>());
        for (int i = 0; i < shownCount; i++)
            shownIds.insert(shownLayerIds[i].as<int>());

        result.set("hiddenCount", hiddenCount);
        result.set("shownCount", shownCount);

        // Create output buffer (RGBA)
        std::vector<unsigned char> output(width * height * 4, 0);

        const auto& header = psdData->parser.fileHeader();
        const auto& layerMaskInfo = psdData->parser.layerAndMaskInformation();
        const auto& layerInfo = layerMaskInfo.layerInfo();
        const auto& records = layerInfo.records();
        const auto& channelImageDataList = layerInfo.channelImageData();

        int renderedCount = 0;

        // Simple approach: just check individual layer visibility
        // Group visibility with hierarchy will be handled by passing all descendant IDs from JS
        int recordCount = records.size();
        for (int i = 0; i < recordCount; ++i) {
            const auto& record = records[i];
            const auto& ali = record.additionalLayerInformation();

            // Get layer ID
            int lyidValue = ali.value("lyid").toInt();
            int layerId = lyidValue > 0 ? lyidValue : (i + 1);

            // Skip group markers - they don't have renderable content
            const auto& lsct = ali.value("lsct");
            if (lsct.isValid() && lsct.canConvert<QPsdSectionDividerSetting>()) {
                auto sectionDivider = lsct.value<QPsdSectionDividerSetting>();
                int type = sectionDivider.type();
                if (type == 1 || type == 2 || type == 3) {
                    continue;
                }
            }

            // Determine visibility
            bool originalVisible = !record.isVisible();  // PSD uses inverted flag
            bool effectiveVisible = hiddenIds.count(layerId) ? false :
                                   shownIds.count(layerId) ? true : originalVisible;

            if (!effectiveVisible) continue;

            QRect rect = record.rect();
            if (rect.isEmpty()) continue;

            // Get layer image data from the separate channelImageData list
            if (i >= channelImageDataList.size()) continue;
            const auto& channelImageData = channelImageDataList[i];
            QByteArray rawData = channelImageData.toImage(header.colorMode());
            if (rawData.isEmpty()) continue;

            bool hasAlpha = channelImageData.hasAlpha();
            QImage::Format format = hasAlpha ? QImage::Format_ARGB32 : QImage::Format_RGB32;
            int bytesPerLine = rect.width() * 4;

            QImage layerImage(reinterpret_cast<const uchar*>(rawData.constData()),
                             rect.width(), rect.height(), bytesPerLine, format);

            if (layerImage.isNull()) continue;

            // Get opacity (0-255 to 0.0-1.0)
            double layerOpacity = record.opacity() / 255.0;

            // Get fill opacity from iOpa (0-255, default to 255 if not present)
            double fillOpacity = 1.0;
            if (ali.contains("iOpa")) {
                fillOpacity = ali.value("iOpa").value<quint8>() / 255.0;
            }

            // Effective opacity = layer opacity * fill opacity (same as psdwidget)
            double opacity = layerOpacity * fillOpacity;

            // Composite this layer onto the output
            compositeLayer(output, width, height,
                          layerImage, rect.x(), rect.y(),
                          record.blendMode(), opacity);
            renderedCount++;
        }

        result.set("renderedLayers", renderedCount);

        // Copy to JavaScript
        qsizetype byteCount = output.size();
        val Uint8ClampedArray = val::global("Uint8ClampedArray");
        val data = Uint8ClampedArray.new_(static_cast<unsigned int>(byteCount));
        data.call<void>("set", val(typed_memory_view(byteCount, output.data())));

        result.set("width", width);
        result.set("height", height);
        result.set("data", data);
        return result;
    } catch (const std::exception& e) {
        result.set("error", std::string("Exception: ") + e.what());
        return result;
    } catch (...) {
        result.set("error", "Unknown exception");
        return result;
    }
}

val renderLayer(double handleD, int layerIndex) {
    val result = val::object();
    int handle = static_cast<int>(handleD);

    try {
        if (handle < 1 || handle >= 16 || s_parsers[handle] == nullptr) {
            result.set("error", std::string("Invalid parser handle: ") + std::to_string(handle));
            return result;
        }
        PsdData* psdData = s_parsers[handle];

        const auto& header = psdData->parser.fileHeader();
        const auto& layerMaskInfo = psdData->parser.layerAndMaskInformation();
        const auto& layerInfo = layerMaskInfo.layerInfo();
        const auto& records = layerInfo.records();

        if (layerIndex < 0 || layerIndex >= records.size()) {
            result.set("error", "Invalid layer index");
            return result;
        }

        const auto& record = records[layerIndex];
        const auto& channelImageData = record.imageData();
        QRect rect = record.rect();

        result.set("x", rect.x());
        result.set("y", rect.y());

        if (rect.width() == 0 || rect.height() == 0) {
            result.set("width", 0);
            result.set("height", 0);
            result.set("data", val::null());
            return result;
        }

        QByteArray rawData = channelImageData.toImage(header.colorMode());

        if (rawData.isEmpty()) {
            result.set("width", 0);
            result.set("height", 0);
            result.set("data", val::null());
            return result;
        }

        bool hasAlpha = channelImageData.hasAlpha();
        QImage::Format format = hasAlpha ? QImage::Format_ARGB32 : QImage::Format_RGB32;
        int bytesPerLine = rect.width() * 4;

        QImage image(reinterpret_cast<const uchar*>(rawData.constData()),
                     rect.width(), rect.height(), bytesPerLine, format);

        if (image.isNull()) {
            result.set("width", 0);
            result.set("height", 0);
            result.set("data", val::null());
            return result;
        }

        // Convert to RGBA8888
        QImage rgbaImage = image.convertToFormat(QImage::Format_RGBA8888);

        if (rgbaImage.isNull()) {
            result.set("width", 0);
            result.set("height", 0);
            result.set("data", val::null());
            return result;
        }

        // Copy to JavaScript (RGBA format, no swap needed)
        qsizetype byteCount = rgbaImage.sizeInBytes();
        val Uint8ClampedArray = val::global("Uint8ClampedArray");
        val data = Uint8ClampedArray.new_(static_cast<unsigned int>(byteCount));

        val sourceView = val(typed_memory_view(byteCount, rgbaImage.constBits()));
        data.call<void>("set", sourceView);

        result.set("width", rgbaImage.width());
        result.set("height", rgbaImage.height());
        result.set("data", data);
        return result;
    } catch (const std::exception& e) {
        result.set("error", std::string("Exception: ") + e.what());
        return result;
    } catch (...) {
        result.set("error", "Unknown exception in renderLayer");
        return result;
    }
}

void releaseParser(double handleD) {
    int handle = static_cast<int>(handleD);
    if (handle >= 1 && handle < 16 && s_parsers[handle] != nullptr) {
        delete s_parsers[handle];
        s_parsers[handle] = nullptr;
    }
}

int main(int, char**) {
    ensureQtApp();
    return 0;
}

EMSCRIPTEN_BINDINGS(psddiff) {
    function("allocateBuffer", &allocateBuffer);
    function("getBufferView", &getBufferView);
    function("parsePsd", &parsePsd);
    function("renderCompositeWithVisibility", &renderCompositeWithVisibility);
    function("renderLayer", &renderLayer);
    function("releaseParser", &releaseParser);
}
