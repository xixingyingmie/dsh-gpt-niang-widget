# 素材来源与许可范围（本项目）

本仓库是 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 的二创。
上游的素材说明原样保留在 [`upstream/PROVENANCE.upstream.md`](upstream/PROVENANCE.upstream.md)，
**那份文本仍然适用于从上游继承的全部素材**（音效、泡泡图）。本文件只补充本项目新增的部分。

## 一、许可范围

| 范围 | 许可 |
|---|---|
| `lib/gptniang-index.js`、`lib/gptniang-widget.js` | **MIT**（生成产物，见 [`LICENSE`](LICENSE)；原始版权归 MeteorNOX） |
| `lib/accounting.mjs`、`skin/`、`tools/`、文档 | **MIT** |
| `assets/gptniang1.png`（角色图） | 由项目发起人提供（原始文件名 `gpt-dragon-niang-bust.png`），经 `tools/set-character-image.py` 规范化后随本仓库按 **MIT** 一并分发 |
| `assets/` 其余文件（音效 / 泡泡图） | 沿用上游说明，见 [`upstream/PROVENANCE.upstream.md`](upstream/PROVENANCE.upstream.md) |

## 二、本项目新增素材

| 文件 | 来源 / 说明 |
|---|---|
| `gptniang1.png` | **已定稿**。项目发起人于 2026-10-08 提供的 `gpt-dragon-niang-bust.png`（1254×1254 RGBA，源文件 1741354 字节）。经脚本居中 1:1 → LANCZOS 缩放到 610×610、剥离全部辅助块后随包，成品 **513179 字节**，SHA-256 `042686f7802a4e3cbc36b9e6fb97cfc952bb72314bb22353eb7a0ac58efb97dd`。 |

替换脚本覆盖前会把旧图备份成 `assets/gptniang1.png.bak-<时间戳>`（`.gitignore` 已忽略），因此历史版本可回滚。

### 替换角色图时的规格要求

用 [`tools/set-character-image.py`](tools/set-character-image.py) 装图即可，它会自动满足下面的要求：

```bash
python tools/set-character-image.py <新图路径>   # 自动居中裁成 1:1 + LANCZOS 缩到 610×610 + 剥元数据 + 备份旧图
python tools/set-character-image.py              # 不带参数 = 只体检当前图
```

上游 `setupHitTest` 的命中画布是 **610×610**，因此目标图必须是：

- **610×610 像素**，RGBA PNG；
- 背景透明；
- 若原图比例不是 1:1，脚本会**先按短边居中裁切再缩放**，不会拉伸。

### 元数据清理（替换后必须做）

上游自 0.3.1 起要求随包 PNG 剥离文本 / EXIF 块。本项目照做：

- `gptniang1.png` 只保留 `IHDR` / `IDAT` / `IEND`；
- 生成工具写入的 **`caBX` 块（C2PA 内容来源追踪）** 必须不存在；
- 剥离是逐块重写，不触碰像素数据，因此画面完全不变。

复核方式：

```bash
python3 - <<'EOF'
import struct
d = open('assets/gptniang1.png','rb').read()
i = 8; chunks = []
while i < len(d):
    n = struct.unpack('>I', d[i:i+4])[0]
    t = d[i+4:i+8].decode('latin1')
    chunks.append(t); i += 12 + n
    if t == 'IEND': break
print(chunks)   # 期望：IHDR/IDAT…/IEND，无 eXIf、iTXt、tEXt、zTXt、caBX
EOF
```

## 三、已移除的上游素材

为减小仓库体积，以下文件已从本项目删除（它们在生成产物中**不再被引用**）：

| 文件 | 原因 |
|---|---|
| `DSniang1.png` / `DSniang02.png` | 上游的小鲸鱼角色图，已由 `gptniang1.png` 取代（产物里两个候选名都已重定向到后者） |
| `DSH2.png` | 上游素材，在源码里 **0 次引用**（死文件），不发 |

## 四、权利主张 / Takedown

若你认为本项目新增素材侵犯了你的权利，请开 issue 说明**文件名**与**依据**，
会在核实后立即替换或移除。上游素材的权利主张请同时参考上游仓库。