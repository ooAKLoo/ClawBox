# 本地卸载前归档

归档日期：2026-10-03。

此分支保留本地尚未推送的 Git stash 原始提交及其父提交。暂存代码涉及扩展管理界面、Skills / Plugins IPC 与类型定义，保留原样，未合并到 main，也未进行功能验证。

原始 stash：`9cfc6ed8a3207b75a94f60d7d2b398b2d1feb23d`。
卸载时 main：`4f5bd4cc387f9f71202339cc106b518ad19d64b9`。

`video-materials/clawbox/` 保存 12 个原始素材文件及 11 个缓存缩略图；逐文件 SHA-256 位于 `video-materials/manifest.json`。保留这些素材用于恢复原视频制作资料，归档不代表获得其中第三方内容的额外使用许可。

未纳入归档的内容为可重新生成的 node_modules、构建输出、打包产物、runtime 依赖，以及机器专用的 Claude 本地权限设置和 .DS_Store。
