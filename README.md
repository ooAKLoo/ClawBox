<div align="center">

<img src="docs/banner.png" alt="ClawBox Banner" width="100%" />

# ClawBox

**OpenClaw 桌面客户端**

[![GitHub stars](https://img.shields.io/github/stars/ooAKLoo/ClawBox?style=social)](https://github.com/ooAKLoo/ClawBox/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ooAKLoo/ClawBox?style=social)](https://github.com/ooAKLoo/ClawBox/network/members)
[![GitHub issues](https://img.shields.io/github/issues/ooAKLoo/ClawBox)](https://github.com/ooAKLoo/ClawBox/issues)
[![GitHub license](https://img.shields.io/github/license/ooAKLoo/ClawBox)](https://github.com/ooAKLoo/ClawBox/blob/main/LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/ooAKLoo/ClawBox)](https://github.com/ooAKLoo/ClawBox/releases)

</div>

---

## 简介

ClawBox 是 OpenClaw 的桌面 GUI 客户端，为 AI 助手提供安全、可控的运行环境。通过可视化面板管理助手场景、模型配置、安全策略和运行日志，开箱即用。

## 功能

- **控制台** — 一站式总览：守护进程状态、助手运行情况、系统诊断
- **助手** — 从场景模板一键创建助手，或用自然语言描述需求自动编排
- **模型管理** — 配置 AI 模型 Provider（API Key / Base URL / Model），支持连接测试
- **安全策略** — 工具权限档位、Shell / 磁盘 / 公网暴露拦截、凭证加密
- **运行日志** — 实时查看助手调用记录，支持筛选、导出、清理
- **系统设置** — 开机自启、自动更新、语言切换、数据目录管理

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 34 |
| 前端 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 3 |
| 动效 | Framer Motion 11 |
| 路由 | React Router 7 |

## 快速开始

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
│   ├── main.ts          # Electron 主进程
│   └── preload.ts       # 预加载脚本（IPC bridge）
├── src/
│   ├── App.tsx           # 应用入口 & 路由
│   ├── components/
│   │   └── Sidebar.tsx   # 侧边栏导航
│   └── pages/
│       ├── Dashboard.tsx   # 控制台
│       ├── Assistants.tsx # 助手 & 场景市场
│       ├── Model.tsx      # 模型配置
│       ├── Security.tsx   # 安全策略
│       ├── Logs.tsx       # 运行日志
│       ├── Settings.tsx   # 系统设置
│       └── Onboarding.tsx # 引导流程
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
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
