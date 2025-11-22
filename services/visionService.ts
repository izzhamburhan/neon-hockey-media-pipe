import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export class VisionService {
  private static instance: VisionService;
  public handLandmarker: HandLandmarker | null = null;
  private constructor() {}

  public static getInstance(): VisionService {
    if (!VisionService.instance) {
      VisionService.instance = new VisionService();
    }
    return VisionService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.handLandmarker) return;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });
      console.log("HandLandmarker loaded successfully");
    } catch (error) {
      console.error("Error loading HandLandmarker:", error);
      throw error;
    }
  }

  public detect(video: HTMLVideoElement, startTimeMs: number) {
    if (!this.handLandmarker) return null;
    return this.handLandmarker.detectForVideo(video, startTimeMs);
  }
}
