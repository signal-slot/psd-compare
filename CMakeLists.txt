# Copyright (C) 2025 Signal Slot Inc.
# SPDX-License-Identifier: LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

cmake_minimum_required(VERSION 3.21)

project(psddiff VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 REQUIRED COMPONENTS Core Gui BuildInternals)

add_subdirectory(qtpsd)

qt_add_executable(psddiff_wasm
    src/wasm/psddiff_wasm.cpp
)

target_link_libraries(psddiff_wasm PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::PsdCore
)

if(EMSCRIPTEN)
    # Link static plugins for WASM builds
    # Additional Layer Information plugins (use CMakeLists target names)
    target_link_libraries(psddiff_wasm PRIVATE
        QPsdAdditionalLayerInformationAnnoPlugin
        QPsdAdditionalLayerInformationBlncPlugin
        QPsdAdditionalLayerInformationBritPlugin
        QPsdAdditionalLayerInformationBrstPlugin
        QPsdAdditionalLayerInformationClrlPlugin
        QPsdAdditionalLayerInformationCurvPlugin
        QPsdAdditionalLayerInformationDataPlugin
        QPsdAdditionalLayerInformationExpaPlugin
        QPsdAdditionalLayerInformationFeidPlugin
        QPsdAdditionalLayerInformationFMskPlugin
        QPsdAdditionalLayerInformationGrdmPlugin
        QPsdAdditionalLayerInformationHue2Plugin
        QPsdAdditionalLayerInformationLclrPlugin
        QPsdAdditionalLayerInformationLevlPlugin
        QPsdAdditionalLayerInformationLfx2Plugin
        QPsdAdditionalLayerInformationLMskPlugin
        QPsdAdditionalLayerInformationLnk_Plugin
        QPsdAdditionalLayerInformationLr16Plugin
        QPsdAdditionalLayerInformationLrFXPlugin
        QPsdAdditionalLayerInformationLsctPlugin
        QPsdAdditionalLayerInformationLsdkPlugin
        QPsdAdditionalLayerInformationLuniPlugin
        QPsdAdditionalLayerInformationMixrPlugin
        QPsdAdditionalLayerInformationNonePlugin
        QPsdAdditionalLayerInformationPattPlugin
        QPsdAdditionalLayerInformationPhflPlugin
        QPsdAdditionalLayerInformationPlLdPlugin
        QPsdAdditionalLayerInformationQpointFPlugin
        QPsdAdditionalLayerInformationSelcPlugin
        QPsdAdditionalLayerInformationShmdPlugin
        QPsdAdditionalLayerInformationSoLdPlugin
        QPsdAdditionalLayerInformationTyShPlugin
        QPsdAdditionalLayerInformationU8Plugin
        QPsdAdditionalLayerInformationU16Plugin
        QPsdAdditionalLayerInformationU32Plugin
        QPsdAdditionalLayerInformationUnknownPlugin
        QPsdAdditionalLayerInformationV16DescriptorPlugin
        QPsdAdditionalLayerInformationVmskPlugin
        QPsdAdditionalLayerInformationVogkPlugin
        QPsdAdditionalLayerInformationVscgPlugin
        QPsdAdditionalLayerInformationVstkPlugin
    )
    # Descriptor plugins
    target_link_libraries(psddiff_wasm PRIVATE
        QPsdDescriptorBoolPlugin
        QPsdDescriptorDoubPlugin
        QPsdDescriptorEnumPlugin
        QPsdDescriptorLongPlugin
        QPsdDescriptorLyidPlugin
        QPsdDescriptorObArPlugin
        QPsdDescriptorObjPlugin
        QPsdDescriptorObjcPlugin
        QPsdDescriptorPthPlugin
        QPsdDescriptorTdtaPlugin
        QPsdDescriptorTextPlugin
        QPsdDescriptorUntFPlugin
        QPsdDescriptorVlLsPlugin
    )
    # Effects layer plugins
    target_link_libraries(psddiff_wasm PRIVATE
        QPsdEffectsLayerBevlPlugin
        QPsdEffectsLayerCmnSPlugin
        QPsdEffectsLayerIglwPlugin
        QPsdEffectsLayerOglwPlugin
        QPsdEffectsLayerShadowPlugin
        QPsdEffectsLayerSofiPlugin
    )
endif()

if(EMSCRIPTEN)
    target_link_options(psddiff_wasm PRIVATE
        -sWASM=1
        -sMODULARIZE=1
        -sEXPORT_NAME='PsdDiffModule'
        -sALLOW_MEMORY_GROWTH=1
        -sMAXIMUM_MEMORY=4GB
        -sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','wasmMemory']
        -sEXPORTED_FUNCTIONS=['_main','_malloc','_free']
        -sENVIRONMENT=web,worker
        -sNO_EXIT_RUNTIME=1
        -sNO_DISABLE_EXCEPTION_CATCHING
        --bind
    )
endif()
