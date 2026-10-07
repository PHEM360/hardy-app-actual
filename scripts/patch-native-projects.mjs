#!/usr/bin/env node
/**
 * Applies store-ready iOS/Android identity after `npx cap add`.
 * Safe to re-run: it only inserts missing keys/files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function copyIfPresent(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function insertPlistKey(plist, key, xml) {
  if (plist.includes(`<key>${key}</key>`)) return plist;
  const block = xml.includes("\n")
    ? `\t<key>${key}</key>\n\t${xml.replace(/\n/g, "\n\t")}`
    : `\t<key>${key}</key>\n\t${xml}`;
  return plist.replace(/\n<\/dict>\n<\/plist>\s*$/, `\n${block}\n</dict>\n</plist>\n`);
}

function patchIos() {
  const infoPath = path.join(root, "ios/App/App/Info.plist");
  if (!fs.existsSync(infoPath)) {
    console.log("Skipping iOS patches — ios/App/App/Info.plist not generated yet.");
    return;
  }

  let info = read(infoPath);
  info = insertPlistKey(
    info,
    "NSCameraUsageDescription",
    "<string>Hardy App uses the camera to scan barcodes, photograph documents and capture notes.</string>",
  );
  info = insertPlistKey(
    info,
    "NSMicrophoneUsageDescription",
    "<string>Hardy App uses the microphone for voice notes and the family phone.</string>",
  );
  info = insertPlistKey(
    info,
    "NSPhotoLibraryUsageDescription",
    "<string>Hardy App lets you attach photos from your library to notes, pets and household records.</string>",
  );
  info = insertPlistKey(
    info,
    "NSPhotoLibraryAddUsageDescription",
    "<string>Hardy App can save photos you capture to your library.</string>",
  );
  info = insertPlistKey(
    info,
    "NSLocationWhenInUseUsageDescription",
    "<string>Hardy App uses your location for weather, dog-tag finders and household maps.</string>",
  );
  info = insertPlistKey(
    info,
    "NSFaceIDUsageDescription",
    "<string>Hardy App uses Face ID so your family passkey can unlock the app on this iPhone.</string>",
  );
  info = insertPlistKey(info, "ITSAppUsesNonExemptEncryption", "<false/>");
  info = insertPlistKey(info, "UIViewControllerBasedStatusBarAppearance", "<true/>");

  if (!info.includes("<string>hardyapp</string>")) {
    info = insertPlistKey(
      info,
      "CFBundleURLTypes",
      `<array>
    <dict>
      <key>CFBundleTypeRole</key>
      <string>Editor</string>
      <key>CFBundleURLName</key>
      <string>uk.co.hardyapp.app</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>hardyapp</string>
      </array>
    </dict>
  </array>`,
    );
  }

  if (!info.includes("<string>audio</string>")) {
    info = insertPlistKey(
      info,
      "UIBackgroundModes",
      `<array>
    <string>audio</string>
    <string>remote-notification</string>
  </array>`,
    );
  }

  write(infoPath, info);

  copyIfPresent(
    path.join(root, "native/ios/App.entitlements"),
    path.join(root, "ios/App/App/App.entitlements"),
  );
  copyIfPresent(
    path.join(root, "native/ios/PrivacyInfo.xcprivacy"),
    path.join(root, "ios/App/App/PrivacyInfo.xcprivacy"),
  );

  const pbx = path.join(root, "ios/App/App.xcodeproj/project.pbxproj");
  if (fs.existsSync(pbx)) {
    let project = read(pbx);
    if (!project.includes("CODE_SIGN_ENTITLEMENTS")) {
      project = project.replaceAll(
        "CODE_SIGN_STYLE = Automatic;",
        'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tCODE_SIGN_STYLE = Automatic;',
      );
    }
    if (!project.includes("PrivacyInfo.xcprivacy")) {
      project = project.replace(
        "/* End PBXBuildFile section */",
        "\t\tA11B22C33D44E55F60718293 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = A11B22C33D44E55F60718294 /* PrivacyInfo.xcprivacy */; };\n/* End PBXBuildFile section */",
      );
      project = project.replace(
        "/* End PBXFileReference section */",
        "\t\tA11B22C33D44E55F60718294 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = \"<group>\"; };\n\t\tA11B22C33D44E55F60718295 /* App.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = \"<group>\"; };\n/* End PBXFileReference section */",
      );
      project = project.replace(
        "504EC3131FED79650016851F /* Info.plist */,",
        "504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\tA11B22C33D44E55F60718294 /* PrivacyInfo.xcprivacy */,\n\t\t\t\tA11B22C33D44E55F60718295 /* App.entitlements */,",
      );
      project = project.replace(
        "2FAD9763203C412B000D30F8 /* config.xml in Resources */,",
        "2FAD9763203C412B000D30F8 /* config.xml in Resources */,\n\t\t\t\tA11B22C33D44E55F60718293 /* PrivacyInfo.xcprivacy in Resources */,",
      );
    }
    write(pbx, project);
  }

  console.log("Patched iOS Info.plist, entitlements and privacy manifest.");
}

function patchAndroid() {
  const manifestPath = path.join(root, "android/app/src/main/AndroidManifest.xml");
  if (!fs.existsSync(manifestPath)) {
    console.log("Skipping Android patches — android project not generated yet.");
    return;
  }

  let manifest = read(manifestPath);
  const permissions = [
    ["android.permission.CAMERA", '<uses-permission android:name="android.permission.CAMERA" />'],
    ["android.permission.RECORD_AUDIO", '<uses-permission android:name="android.permission.RECORD_AUDIO" />'],
    ["android.permission.ACCESS_COARSE_LOCATION", '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />'],
    ["android.permission.ACCESS_FINE_LOCATION", '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />'],
    ["android.permission.MODIFY_AUDIO_SETTINGS", '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />'],
    ["android.permission.VIBRATE", '<uses-permission android:name="android.permission.VIBRATE" />'],
    ["android.permission.POST_NOTIFICATIONS", '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'],
  ];
  for (const [needle, tag] of permissions) {
    if (!manifest.includes(needle)) {
      manifest = manifest.replace("<application", `${tag}\n    <application`);
    }
  }

  if (!manifest.includes("android:host=\"hardyapp.co.uk\"")) {
    manifest = manifest.replace(
      "</intent-filter>",
      `</intent-filter>
        <intent-filter android:autoVerify="true">
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="https" android:host="hardyapp.co.uk" />
            <data android:scheme="https" android:host="www.hardyapp.co.uk" />
        </intent-filter>
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="hardyapp" />
        </intent-filter>`,
    );
  }

  write(manifestPath, manifest);

  const stringsPath = path.join(root, "android/app/src/main/res/values/strings.xml");
  if (fs.existsSync(stringsPath)) {
    let strings = read(stringsPath);
    strings = strings.replace(
      /<string name="title_activity_main">[^<]*<\/string>/,
      '<string name="title_activity_main">Hardy App</string>',
    );
    strings = strings.replace(
      /<string name="package_name">[^<]*<\/string>/,
      '<string name="package_name">uk.co.hardyapp.app</string>',
    );
    strings = strings.replace(
      /<string name="custom_url_scheme">[^<]*<\/string>/,
      '<string name="custom_url_scheme">uk.co.hardyapp.app</string>',
    );
    write(stringsPath, strings);
  }

  console.log("Patched AndroidManifest permissions and deep links.");
}

patchIos();
patchAndroid();
