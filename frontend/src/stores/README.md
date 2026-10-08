# stores/

跨页面共享状态的存放位置。

Phase 1 还没有需要全局共享的状态，因此目录先留空。

计划：

- Phase 3：当前进行中的训练（active workout）草稿状态
- Phase 8：离线队列与同步状态

约定：组件内的一次性状态用 `useState`，只有真正跨页面共享的数据才放进 stores。
