<div align="center">

<img src="docs/banner.png" alt="ClawBox Banner" width="100%" />

# ClawBox

**让 AI 助手安全落地的桌面客户端**

[![GitHub release](https://img.shields.io/github/v/release/ooAKLoo/ClawBox?style=flat-square&color=blue)](https://github.com/ooAKLoo/ClawBox/releases)
[![GitHub license](https://img.shields.io/github/license/ooAKLoo/ClawBox?style=flat-square)](https://github.com/ooAKLoo/ClawBox/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/ooAKLoo/ClawBox?style=flat-square&color=yellow)](https://github.com/ooAKLoo/ClawBox/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/ooAKLoo/ClawBox?style=flat-square)](https://github.com/ooAKLoo/ClawBox/issues)

**下载即用 · 零配置启动 · 多层安全防护**

[下载安装](#-一键安装) · [安全架构](#-安全防护) · [功能概览](#-功能概览) · [参与贡献](#贡献)

</div>

---

## ✨ 为什么选择 ClawBox？

> 你只需要下载一个安装包 —— 环境、运行时、安全策略，ClawBox 全部帮你搞定。

| | 传统方式 | ClawBox |
|---|---|---|
| 环境配置 | 手动安装 Node.js、Python、各种依赖 | **自动内置，零依赖** |
| 运行时管理 | 命令行手动下载、配置 PATH | **自动下载验证，开箱即用** |
| 安全防护 | 无防护，助手可随意执行任何操作 | **六层纵深防御，全方位拦截** |
| 助手管理 | 编辑 YAML / JSON 配置文件 | **可视化面板，点击即配** |

---

## 📦 一键安装

<table>
<tr>
<td align="center"><b>macOS</b></td>
<td align="center"><b>Windows</b></td>
</tr>
<tr>
<td align="center">
下载 <code>.dmg</code> → 拖入 Applications → 启动
</td>
<td align="center">
下载 <code>.exe</code> → 双击安装 → 启动
</td>
</tr>
</table>

👉 **[前往 Releases 页面下载最新版](https://github.com/ooAKLoo/ClawBox/releases)**

安装后 ClawBox 会自动完成：

1. **环境检测** — 验证系统兼容性与必要组件
2. **运行时下载** — 自动拉取 OpenClaw 引擎并校验原生模块完整性
3. **冒烟测试** — 验证所有 native binding 正常加载
4. **引导配置** — 可视化向导完成模型与助手的首次设置

**无需命令行，无需手动配置，下载即用。**

---

## 🛡 安全防护

ClawBox 内建 **六层纵深安全体系**，确保 AI 助手在可控范围内运行：

```
┌─────────────────────────────────────────────┐
│            🔐 凭证加密存储                    │
│  API Key 通过系统钥匙串加密，永不明文落盘       │
├─────────────────────────────────────────────┤
│            🐚 Shell 执行管控                  │
│  三档控制：全部禁止 / 白名单放行 / 完全放开     │
├─────────────────────────────────────────────┤
│            ⛔ 危险命令拦截                     │
│  rm -rf / mkfs / fork bomb 等高危指令实时阻断  │
├─────────────────────────────────────────────┤
│            📁 磁盘访问隔离                     │
│  文件操作限定工作区目录，防止越权读写            │
├─────────────────────────────────────────────┤
│            🌐 公网暴露检测                     │
│  每 60 秒扫描外部可达性，发现暴露即时告警        │
├─────────────────────────────────────────────┤
│            🧠 Prompt 注入扫描                  │
│  实时检测恶意提示词注入，自动标记可疑输入         │
└─────────────────────────────────────────────┘
```

> 安全策略变更后守护进程自动重启，策略**即改即生效**。

---

## 🧩 功能概览

| 模块 | 说明 |
|---|---|
| **控制台** | 守护进程状态、助手运行情况、系统诊断一站式总览 |
| **助手** | 场景模板一键创建，或用自然语言描述需求自动编排 |
| **模型管理** | 配置 Provider（API Key / Base URL / Model），支持连接测试 |
| **安全策略** | 工具权限分级、Shell / 磁盘 / 公网拦截策略面板 |
| **运行日志** | 实时助手调用记录，支持筛选、导出、清理 |
| **系统设置** | 开机自启、自动更新、语言切换、数据目录管理 |

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 34 |
| 前端 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 3 |
| 动效 | Framer Motion 11 |
| 路由 | React Router 7 |

---

## 开发

```bash
# 克隆仓库
git clone https://github.com/ooAKLoo/ClawBox.git
cd ClawBox

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建打包
npm run package
```

## 项目结构

```
ClawBox/
├── electron/
│   ├── main.ts             # Electron 主进程
│   ├── preload.ts          # 预加载脚本（IPC bridge）
│   └── lib/
│       ├── daemon.ts       # 守护进程生命周期
│       └── security.ts     # 安全策略引擎
├── src/
│   ├── App.tsx             # 应用入口 & 路由
│   ├── pages/              # 页面组件
│   ├── sections/           # 功能区块
│   └── components/         # 通用组件
├── scripts/
│   ├── download-openclaw.js  # 运行时自动下载 & 校验
│   └── smoke-test.js         # Native binding 完整性验证
└── package.json
```

## 贡献

欢迎提交 Issue 和 Pull Request。

## License

MIT

---

<div align="center">

### Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ooAKLoo/ClawBox&type=Date)](https://star-history.com/#ooAKLoo/ClawBox&Date)

</div>
