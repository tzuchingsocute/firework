# 标注视频素材接口

在本目录放置有合法使用权限的 Y4M 视频和 `manifest.json`。默认没有已标注的真人视频。未提供标注素材时，工具继续运行内置肖像行为序列，并将真人正脸检测率和人工标注精度标为 BLOCKED。

用自录且获同意的素材，或有明确许可的素材。保留来源、授权和标注者记录。建议 30 FPS 恒定帧率，画面先预留 10 秒用于加载模型，再依次录制正脸、转头、移动、离开和回到画面。完整视频要比最后一个标注至少长 0.2 秒。Chrome 重复播放素材时仍只使用首轮时间范围。

已有合法视频时，可自行用 FFmpeg 转换。

```sh
ffmpeg -i input.mp4 -vf fps=30 -pix_fmt yuv420p reference.y4m
```

清单示例仅展示字段。需要自行填写真实标注，并提供至少 20 个正面样本以及全部五种场景。

```json
{
  "video": "reference.y4m",
  "source": "素材来源或自录记录",
  "license": "授权范围或同意记录",
  "annotator": "人工标注者",
  "samples": [
    {
      "scene": "front",
      "time": 12.0,
      "box": { "width": 0.42, "height": 0.58 },
      "points": [
        { "index": 1, "x": 0.55, "y": 0.47 },
        { "index": 33, "x": 0.40, "y": 0.38 },
        { "index": 263, "x": 0.65, "y": 0.38 }
      ]
    },
    { "scene": "absent", "time": 18.0 }
  ]
}
```

场景为 `front`、`turn`、`move`、`absent`、`return`。时间是原视频中自开始起的秒数，严格递增且最后一个小于 120 秒。所有有脸的样本至少有三个不同参考点及人脸框宽高。坐标依据未经镜像和裁切的原始画面归一化至 0–1，原点在左上。索引使用 MediaPipe 478 点编号。面部框宽度除以视频宽度，高度除以视频高度。精度按屏幕空间中的人脸框对角线归一化。

也可设置 `STAGE1_MANIFEST=/absolute/path/manifest.json`，并用 `STAGE1_VIDEO` 指向其他 Y4M 文件。不要提交未获共享授权的素材。

## 随仓库提供的行为测试素材

`grace-hopper.gray` 是 U.S. Navy 官方肖像（James S. Davis，NH 96919-KN）的 150 × 176 灰度版。从 Matplotlib 3.10.0 的发布包中提取 `grace_hopper.jpg`，转灰度并缩放后保存为逐行 8 位像素。肖像在美国属公共领域。[肖像及许可](https://commons.wikimedia.org/wiki/File:Grace_Hopper.jpg)

`npm run test:stage1` 用该图生成循环 12 秒的 Y4M，本地输入 Chromium 模拟摄像头。序列包含持续有人脸、持续无人脸、人脸返回，以及肖像向左右平移。测试使用实际 MediaPipe 推理，记录模型输出、状态和画布像素。平移用于验证动态更新。真人转头、正脸检测率和定位精度需要按上面的清单另行采集与人工标注；灰度肖像序列不提供定位真值。

`eileen-collins.gray` is a 150 × 176 grayscale crop of the public-domain NASA
Eileen Collins photograph distributed as `skimage/data/astronaut.png` in
scikit-image 0.24.0. The source crop is (75, 0)–(375, 352) in the original
512 × 512 image. [Image and license](https://pydocs.github.io/p/skimage/0.17.2/api/skimage.data.astronaut).

The manually sampled upper hair silhouette in `face-fixture.js` uses
source-crop coordinates. Its interpolation is a static reference and does
not use MediaPipe output. The footage is a replay of a still photograph.

The holdout files are crops from [NASA's Sally Ride portrait](https://www.nasa.gov/former-astronaut-sally-ride/), with [public-domain provenance](https://commons.wikimedia.org/wiki/File:Sally_Ride,_First_U.S._Woman_in_Space_-_GPN-2004-00019.jpg). Both are 150 × 176 grayscale. The tilt variant adds a 12° rotation, 0.71 brightness and a larger playback scale. Each upper contour was manually read from its pixels before running the model. This is one additional hairstyle under two controlled conditions; the tilted and dimmed variant is synthetic.
