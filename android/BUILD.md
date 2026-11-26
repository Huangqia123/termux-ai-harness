# Android 构建说明

APK 用 aapt2 / d8 / apksigner 直接构建，不需要 Gradle。

```bash
SDK=$HOME/android-sdk
BT=$SDK/build-tools/34.0.0
AJ=$SDK/platforms/android-34/android.jar

aapt2 compile --dir res -o build_out/res.zip
aapt2 link -o build_out/base.apk -I $AJ --manifest AndroidManifest.xml \
  -A assets --java build_out/gen --min-sdk-version 24 --target-sdk-version 34 build_out/res.zip

javac -source 1.8 -target 1.8 -bootclasspath $AJ -d build_out/classes $(find java build_out/gen -name '*.java')
d8 --lib $AJ --min-api 24 --output build_out/dex $(find build_out/classes -name '*.class')

zip: 把 classes.dex 追加进 base.apk
zipalign -f -p 4 build_out/withdex.apk build_out/aligned.apk

apksigner sign --ks signing/termux-ai-harness.keystore \
  --ks-pass pass:android --key-pass pass:android \
  --out TermuxAIHarness-x.y.z-android.apk build_out/aligned.apk
```

**签名必须一直用 `signing/termux-ai-harness.keystore`**，换 key 会导致老用户无法覆盖安装（`INSTALL_FAILED_UPDATE_INCOMPATIBLE`）。

`versionCode` 每版递增（当前 1040100），小于已装版本会被系统按降级拦截。
