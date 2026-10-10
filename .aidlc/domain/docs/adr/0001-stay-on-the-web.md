# 这一产品留在网页里

Demo 把迁到 Unity 留成了以后的选项。决定继续用 Three.js 在浏览器里做，工程用 Vite 和 TypeScript。胡牌场面已经在网页里验证过，换引擎等于把这块重做一遍。生产构建除可选外接 AI 外不访问网络，可从本地静态服务器离线游玩；首个可玩版本只验收最新版桌面 Chrome 和 Edge。运行环境必须支持 WebGL2，不维护 WebGL1 降级实现；不支持时显示明确说明。

## Considered options

- 迁到 Unity
- 维持无打包的静态脚本
