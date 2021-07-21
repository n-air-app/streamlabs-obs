import {
    OptimizeSettings, SettingsKeyAccessor, OptimizationKey, EncoderType
} from './optimizer';

/**
 * niconicoに最適な設定値を返す。
 */
export function getBestSettingsForNiconico(
    options: {
        bitrate: number,
        useHardwareEncoder?: boolean
    },
    settings: SettingsKeyAccessor
): OptimizeSettings {
    let audioBitrate: number;
    let resolution: string;
    if (options.bitrate >= 6000) {
        audioBitrate = 192;
        resolution = '1280x720';
    } else if (options.bitrate >= 2000) {
        audioBitrate = 192;
        resolution = '800x450';
    } else if (options.bitrate >= 1000) {
        audioBitrate = 96;
        resolution = '800x450';
    } else if (options.bitrate >= 384) {
        audioBitrate = 48;
        resolution = '512x288';
    } else {
        audioBitrate = 48;
        resolution = '512x288';
    }

    let encoderSettings: OptimizeSettings = {
        encoder: EncoderType.x264,
        simpleUseAdvanced: true,
        encoderPreset: 'ultrafast',
    };
    if (!('useHardwareEncoder' in options) || options.useHardwareEncoder) {
        if (settings.hasSpecificValue(OptimizationKey.encoder, EncoderType.nvencNew)) {
            encoderSettings = {
                encoder: EncoderType.nvencNew,
                simpleUseAdvanced: true,
                NVENCPreset: 'llhq',
            };
        } else if (settings.hasSpecificValue(OptimizationKey.encoder, EncoderType.nvenc) ||
            settings.hasSpecificValue(OptimizationKey.encoder, EncoderType.advancedNvenc)) {
            encoderSettings = {
                encoder: EncoderType.nvenc,
                simpleUseAdvanced: true,
                NVENCPreset: 'llhq',
            };
        } else if (settings.hasSpecificValue(OptimizationKey.encoder, EncoderType.qsv) ||
            settings.hasSpecificValue(OptimizationKey.encoder, EncoderType.advancedQsv)) {
            encoderSettings = {
                encoder: EncoderType.qsv,
                simpleUseAdvanced: true,
                targetUsage: 'speed',
            };
        }
    }

    const commonSettings: OptimizeSettings = {
        outputMode: 'Simple',
        videoBitrate: (options.bitrate - audioBitrate),
        audioBitrate: audioBitrate.toString(10),
        quality: resolution,
        fpsType: 'Common FPS Values',
        fpsCommon: '30',
        audioSampleRate: 48000,
    };

    // 出力=詳細(Output: Advanced) のときのエンコーダー以外の設定
    const advancedSettings: OptimizeSettings = {
        outputMode: 'Advanced',
        advRateControl: 'CBR',
        advColorSpace: '709',
        advKeyframeInterval: 300,
        advProfile: 'high',
        advAudioTrackIndex: '1',
    };

    return {
        ...commonSettings,
        // ...advancedSettings, // #239 のワークアラウンドでコメントアウト: 出力=詳細が最適化に使える様になったときに有効にしたい
        ...encoderSettings
    };
}
