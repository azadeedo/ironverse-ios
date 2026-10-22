# Adds the Ironverse Apple Watch app (ios/App/IronverseWatch) to the Xcode
# project as a watchOS target embedded in the iPhone app. Runs on Codemagic
# (macOS, xcodeproj gem) before the signed build; idempotent.
#
#   ruby tools/watch/add_watch_target.rb
require 'xcodeproj'

PROJECT = File.expand_path('../../ios/App/App.xcodeproj', __dir__)
NAME = 'IronverseWatch'
BUNDLE = 'com.nouriapps.ironverse.watchkitapp'
TEAM = '4GQLMSC3VS'

proj = Xcodeproj::Project.open(PROJECT)
if proj.targets.any? { |t| t.name == NAME }
  puts "#{NAME} target already present"
  exit 0
end

app = proj.targets.find { |t| t.name == 'App' } or abort('App target not found')
app_cfg = app.build_configurations.find { |c| c.name == 'Release' }.build_settings
marketing = app_cfg['MARKETING_VERSION'] || '1.0.0'
build_no = app_cfg['CURRENT_PROJECT_VERSION'] || '1'

watch = proj.new_target(:application, NAME, :watchos, '10.0', nil, :swift)

group = proj.main_group.new_group(NAME, NAME)
sources = Dir[File.join(File.dirname(PROJECT), NAME, '*.swift')].sort.map { |f| group.new_reference(File.basename(f)) }
watch.add_file_references(sources)
assets = group.new_reference('Assets.xcassets')
watch.resources_build_phase.add_file_reference(assets)
group.new_reference('Info.plist')

watch.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = BUNDLE
  s['PRODUCT_NAME'] = 'Ironverse'
  s['INFOPLIST_FILE'] = "#{NAME}/Info.plist"
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['SDKROOT'] = 'watchos'
  s['WATCHOS_DEPLOYMENT_TARGET'] = '10.0'
  s['TARGETED_DEVICE_FAMILY'] = '4'
  s['SWIFT_VERSION'] = '5.0'
  s['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  s['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
  s['MARKETING_VERSION'] = marketing
  s['CURRENT_PROJECT_VERSION'] = build_no
  s['SKIP_INSTALL'] = 'YES'
  s['DEVELOPMENT_TEAM'] = TEAM
  s['CODE_SIGN_STYLE'] = 'Manual'
  s['ENABLE_PREVIEWS'] = 'NO'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks']
end

# the iPhone app builds and embeds the Watch app
app.add_dependency(watch)
embed = app.new_copy_files_build_phase('Embed Watch Content')
embed.dst_subfolder_spec = '16' # products directory
embed.dst_path = '$(CONTENTS_FOLDER_PATH)/Watch'
bf = embed.add_file_reference(watch.product_reference, true)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

proj.save
puts "Added #{NAME} (#{BUNDLE}) v#{marketing} (#{build_no}) to #{PROJECT}"
