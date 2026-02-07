// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only
//
// This is the main-thread Qt rendering module.
// Uses QApplication + QPsdScene for full scene rendering with effects.

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <set>

#include <QtCore/QBuffer>
#include <QtCore/QFile>
#include <QtCore/QDir>
#include <QtWidgets/QApplication>
#include <QtPlugin>
#include <QtGui/QImage>
#include <QtGui/QPainter>
#include <QtGui/QFontDatabase>

#include <QtPsdCore/QPsdParser>
#include <QtPsdCore/QPsdLayerRecord>
#include <QtPsdCore/qpsdblend.h>
#include <QtPsdCore/QPsdSectionDividerSetting>

#include <QtPsdWidget/QPsdWidgetTreeItemModel>
#include <QtPsdWidget/QPsdScene>

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

// Global Qt application instance (QApplication for full widgets support)
static int s_argc = 1;
static char* s_argv[] = { (char*)"psddiff_qt", nullptr };
static QApplication* s_app = nullptr;

// Buffer for receiving data from JavaScript
static QByteArray s_dataBuffer;

void ensureQtApp() {
    if (!s_app) {
        s_app = new QApplication(s_argc, s_argv);
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

// Font buffer for receiving font data from JavaScript
static QByteArray s_fontBuffer;

// Track registered fonts: font family names
static std::vector<std::string> s_registeredFontFamilies;

void allocateFontBuffer(int size) {
    s_fontBuffer.resize(size);
}

val getFontBufferView() {
    return val(typed_memory_view(s_fontBuffer.size(),
               reinterpret_cast<unsigned char*>(s_fontBuffer.data())));
}

static int s_nextFontId = 1;

// Register a font from the font buffer
val registerFont(int dataSize, const std::string& filename) {
    val result = val::object();

    ensureQtApp();

    if (dataSize <= 0 || dataSize > s_fontBuffer.size()) {
        result.set("error", "Invalid font data size");
        return result;
    }

    QByteArray fontData(s_fontBuffer.constData(), dataSize);

    // Use Qt's official API for adding fonts at runtime
    int fontId = QFontDatabase::addApplicationFontFromData(fontData);

    if (fontId < 0) {
        result.set("error", "Failed to register font - QFontDatabase rejected the font");
        return result;
    }

    // Get the font families from the registered font
    QStringList families = QFontDatabase::applicationFontFamilies(fontId);

    if (families.isEmpty()) {
        result.set("error", "Failed to register font - no font families found in file");
        return result;
    }

    // Store registered family names
    val familiesArray = val::array();
    for (const QString& family : families) {
        std::string familyStr = family.toStdString();
        s_registeredFontFamilies.push_back(familyStr);
        familiesArray.call<void>("push", familyStr);
    }

    result.set("fontId", fontId);
    result.set("families", familiesArray);
    return result;
}

// Get list of all registered font families
val getRegisteredFonts() {
    val result = val::array();
    for (const auto& family : s_registeredFontFamilies) {
        result.call<void>("push", family);
    }
    return result;
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

// Structure to hold PSD data including model and scene
struct PsdData {
    QString tempPath;
    std::unique_ptr<QPsdWidgetTreeItemModel> model;
    std::unique_ptr<QPsdScene> scene;
    int width = 0;
    int height = 0;
    int colorMode = 0;
};

// Simple array-based handle storage (handles are 1-based indices)
static PsdData* s_parsers[16] = {nullptr};

static int findFreeHandle() {
    for (int i = 1; i < 16; i++) {
        if (s_parsers[i] == nullptr) {
            return i;
        }
    }
    return -1;
}

// Parse PSD and return parser handle
val parsePsd(int dataSize) {
    ensureQtApp();

    val result = val::object();

    if (dataSize <= 0 || dataSize > s_dataBuffer.size()) {
        result.set("error", "Invalid data size");
        return result;
    }

    // Create data structure
    PsdData* psdData = new PsdData();

    // Save to temp file
    static int tempFileCounter = 0;
    psdData->tempPath = QString("/tmp/psd_%1.psd").arg(tempFileCounter++);
    QFile tempFile(psdData->tempPath);
    if (!tempFile.open(QIODevice::WriteOnly)) {
        delete psdData;
        result.set("error", std::string("Cannot create temp file: ") + psdData->tempPath.toStdString());
        return result;
    }

    tempFile.write(s_dataBuffer.constData(), dataSize);
    tempFile.close();

    // Load using QPsdWidgetTreeItemModel
    psdData->model = std::make_unique<QPsdWidgetTreeItemModel>();
    psdData->model->load(psdData->tempPath);

    if (!psdData->model->errorMessage().isEmpty()) {
        QString error = psdData->model->errorMessage();
        delete psdData;
        result.set("error", std::string("Failed to load PSD: ") + error.toStdString());
        return result;
    }

    QSize size = psdData->model->size();
    psdData->width = size.width();
    psdData->height = size.height();

    if (psdData->width == 0 || psdData->height == 0) {
        delete psdData;
        result.set("error", "Failed to parse PSD - invalid dimensions");
        return result;
    }

    // Create scene
    psdData->scene = std::make_unique<QPsdScene>();
    psdData->scene->setModel(psdData->model.get());

    // Store in handle array
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

    // Build layers array from model
    val layers = val::array();

    std::function<void(const QModelIndex&)> traverseModel = [&](const QModelIndex& parent) {
        for (int row = 0; row < psdData->model->rowCount(parent); ++row) {
            QModelIndex index = psdData->model->index(row, 0, parent);
            val layer = val::object();

            int layerId = psdData->model->layerId(index);
            layer.set("id", layerId);
            layer.set("index", row);
            layer.set("name", psdData->model->layerName(index).toStdString());

            const auto* item = psdData->model->layerItem(index);
            if (item) {
                QRect rect = item->rect();
                layer.set("x", rect.x());
                layer.set("y", rect.y());
                layer.set("width", rect.width());
                layer.set("height", rect.height());
                layer.set("visible", item->isVisible());
                layer.set("opacity", static_cast<int>(item->opacity() * 255));
                layer.set("blendMode", blendModeToString(item->record().blendMode()));

                // Determine type
                if (psdData->model->hasChildren(index)) {
                    layer.set("type", std::string("group"));
                } else {
                    layer.set("type", std::string("layer"));
                }
            }

            layers.call<void>("push", layer);

            // Recurse into children
            traverseModel(index);
        }
    };
    traverseModel(QModelIndex());

    result.set("layers", layers);
    return result;
}

// Render composite using QPsdScene
val renderCompositeWithQt(double handleD, val hiddenLayerIdsVal, val shownLayerIdsVal) {
    val result = val::object();
    int handle = static_cast<int>(handleD);

    try {
        if (handle < 1 || handle >= 16 || s_parsers[handle] == nullptr) {
            result.set("error", std::string("Invalid parser handle: ") + std::to_string(handle));
            return result;
        }
        PsdData* psdData = s_parsers[handle];

        int width = psdData->width;
        int height = psdData->height;

        if (width == 0 || height == 0) {
            result.set("error", "Invalid dimensions");
            return result;
        }

        // Parse hidden/shown layer IDs and update visibility
        std::set<int> hiddenIds;
        std::set<int> shownIds;

        int hiddenCount = hiddenLayerIdsVal["length"].as<int>();
        for (int i = 0; i < hiddenCount; ++i) {
            hiddenIds.insert(hiddenLayerIdsVal[i].as<int>());
        }

        int shownCount = shownLayerIdsVal["length"].as<int>();
        for (int i = 0; i < shownCount; ++i) {
            shownIds.insert(shownLayerIdsVal[i].as<int>());
        }

        // First, reset all layer visibility to original state from model
        std::function<void(const QModelIndex&)> resetVisibility = [&](const QModelIndex& parent) {
            for (int row = 0; row < psdData->model->rowCount(parent); ++row) {
                QModelIndex index = psdData->model->index(row, 0, parent);
                const auto* layerItem = psdData->model->layerItem(index);
                if (layerItem) {
                    quint32 layerId = layerItem->id();
                    bool originalVisible = layerItem->isVisible();
                    psdData->scene->setItemVisible(layerId, originalVisible);
                }
                resetVisibility(index);
            }
        };
        resetVisibility(QModelIndex());

        // Then apply visibility overrides
        for (int id : hiddenIds) {
            psdData->scene->setItemVisible(static_cast<quint32>(id), false);
        }
        for (int id : shownIds) {
            psdData->scene->setItemVisible(static_cast<quint32>(id), true);
        }

        // Render the scene to an image
        QImage image(width, height, QImage::Format_ARGB32_Premultiplied);
        image.fill(Qt::transparent);

        QPainter painter(&image);
        psdData->scene->render(&painter);
        painter.end();

        // Convert to RGBA8888 for JavaScript
        QImage rgbaImage = image.convertToFormat(QImage::Format_RGBA8888);
        qsizetype byteCount = rgbaImage.sizeInBytes();

        val Uint8ClampedArray = val::global("Uint8ClampedArray");
        val data = Uint8ClampedArray.new_(static_cast<unsigned int>(byteCount));
        val sourceView = val(typed_memory_view(byteCount, rgbaImage.constBits()));
        data.call<void>("set", sourceView);

        result.set("width", width);
        result.set("height", height);
        result.set("data", data);
        result.set("renderMode", std::string("qt"));
        return result;
    } catch (const std::exception& e) {
        result.set("error", std::string("Exception: ") + e.what());
        return result;
    } catch (...) {
        result.set("error", "Unknown exception");
        return result;
    }
}

void releaseParser(double handleD) {
    int handle = static_cast<int>(handleD);
    if (handle >= 1 && handle < 16 && s_parsers[handle] != nullptr) {
        // Remove temp file
        QFile::remove(s_parsers[handle]->tempPath);
        delete s_parsers[handle];
        s_parsers[handle] = nullptr;
    }
}

int main(int, char**) {
    ensureQtApp();
    return 0;
}

EMSCRIPTEN_BINDINGS(psddiff_qt) {
    function("allocateBuffer", &allocateBuffer);
    function("getBufferView", &getBufferView);
    function("parsePsd", &parsePsd);
    function("renderCompositeWithQt", &renderCompositeWithQt);
    function("releaseParser", &releaseParser);
    // Font registration
    function("allocateFontBuffer", &allocateFontBuffer);
    function("getFontBufferView", &getFontBufferView);
    function("registerFont", &registerFont);
    function("getRegisteredFonts", &getRegisteredFonts);
}
