# Android APK Build Guide

## Prerequisites

Install EAS CLI globally:
```bash
npm install -g eas-cli
```

Login to your Expo account:
```bash
eas login
```

## Building the APK

**Preview APK** (for testing — downloads as .apk, sideload on device):
```bash
npm run build:android:preview
```

**Production APK**:
```bash
npm run build:android:prod
```

EAS builds run in the cloud. When done you get a download link for the `.apk` file.

## Connecting a Real Android Device

The default `BASE_URL` in `src/services/api.js` uses `10.0.2.2` which only works in the Android emulator.

For a real device on the same Wi-Fi network:

1. Find your PC's local IP:
   ```
   ipconfig
   ```
   Look for **IPv4 Address** under your Wi-Fi adapter, e.g. `192.168.1.42`.

2. Update `.env.production`:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.42:3001/api
   ```

3. Make sure the backend is running and your firewall allows port 3001.

## IP Reference

| Target             | URL to use                        |
|--------------------|-----------------------------------|
| Android emulator   | `http://10.0.2.2:3001/api`        |
| Real device (WiFi) | `http://192.168.x.x:3001/api`     |
| Expo Go web        | `http://localhost:3001/api`        |
