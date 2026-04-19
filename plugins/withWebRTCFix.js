const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Patches the Podfile to allow react-native-webrtc's non-modular React headers
// when useFrameworks: static is set (required by Firebase).
module.exports = function withWebRTCFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const patch = [
        '    # Allow react-native-webrtc non-modular headers when useFrameworks: static is set',
        '    installer.pods_project.targets.each do |target|',
        "      if target.name == 'livekit-react-native-webrtc'",
        '        target.build_configurations.each do |config|',
        "          config.build_settings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
        '        end',
        '      end',
        '    end',
      ].join('\n');

      if (!podfile.includes('ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        podfile = podfile.replace(
          /(post_install do \|installer\|[\s\S]*?)(  end\nend)/,
          `$1${patch}\n$2`
        );
        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};
