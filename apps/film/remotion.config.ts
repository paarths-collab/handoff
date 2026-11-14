import { Config } from "@remotion/cli/config";

// Keep film artwork and its licenses local to this application repository.
Config.setPublicDir("public");
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setCrf(16);
