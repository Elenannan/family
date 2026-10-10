公开网站上传版

将本文件夹的内容部署到静态网站托管服务。首页为 index.html。
GitHub Pages 可使用公开仓库，并在 Settings → Pages 选择对应发布分支及根目录。
当前未绑定独立域名；无需购买域名即可使用 GitHub Pages 提供的 github.io 地址。

照片与字体资源都在文件夹内，不依赖电脑上的绝对路径。
本版本为单页布局：上方为祝贺词，下方为全部家人照片。保留日夜模式、照片顺序和点击翻转。
旧的 album.html 和 family.html 地址会自动跳转至首页。
修改本地原版后，需要重新准备并上传更新版，网上的内容才会改变。

图片优化：原始照片仍保存在“二人照片”和“家人合影”中，网页使用 assets/optimized 的等比例 JPG/PNG 副本。手机和电脑按屏幕尺寸自动选择清晰度；背面原图仅在点击时加载。
新增照片或修改文字后，请先安装 scripts/asset-requirements.txt 中的依赖，再运行 python scripts/optimize_assets.py，同时上传生成的资源、HTML 和样式。字体子集也会自动更新，以包含新文字。
