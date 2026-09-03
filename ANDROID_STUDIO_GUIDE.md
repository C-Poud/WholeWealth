# Building WholeWealth in Android Studio

The complete native Android project is generated in the `/android` directory ready to open directly in **Android Studio**.

---

### Step 1: Open in Android Studio
1. Launch **Android Studio** on your computer.
2. Select **Open** (or **File > Open**).
3. Navigate to this project folder and select the `android` directory (e.g. `path/to/project/android`).
4. Wait a moment for Gradle to sync.

---

### Step 2: Build the Sideloadable APK
To build the `.apk` file:
1. In Android Studio's top menu bar, click:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. Once the build completes, a pop-up appears in the bottom-right corner:
   Click **"locate"** to open the folder containing `app-debug.apk`.

Or build from the terminal:
```bash
cd android
./gradlew assembleDebug
```
The output APK file will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

### Step 3: Build a Release / Signed APK
To produce a signed production APK or Google Play AAB:
1. In Android Studio, go to:
   **Build > Generate Signed Bundle / APK...**
2. Choose **APK** (or Android App Bundle for Google Play).
3. Create or select your keystore credentials, select `release`, and click **Finish**.

---

### Step 4: Updating the App
Whenever you make frontend changes in the web app:
```bash
npm run build
npm run android:sync
```
This updates the Android assets inside `android/app/src/main/assets/public`.
