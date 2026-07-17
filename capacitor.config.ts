import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.mychillz.chillz",
  appName: "Chillz",
  webDir: "out",
  server: {
    url: "https://chillz-two.vercel.app",
    cleartext: true,
    androidScheme: "https",
    iosScheme: "https",
    hostname: "mychillz.app",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#3A0080",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#3A0080",
    },
  },
};

export default config;