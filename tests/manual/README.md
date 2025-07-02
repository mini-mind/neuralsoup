# 手动测试脚本

这个目录包含用于手动测试应用功能的脚本。这些脚本不会自动运行，需要手动在浏览器控制台中执行。

## 使用方法

1. 启动开发服务器：`npm run dev`
2. 在浏览器中打开应用
3. 打开浏览器开发者工具的控制台
4. 手动导入并运行测试脚本

## 测试脚本

### plugin-system-test.ts
测试插件系统的配置和可见性控制。

**使用方法：**
```javascript
// 在控制台中手动导入并运行
import('./tests/manual/plugin-system-test.js').then(module => {
  module.runAllTests();
});
```

### mouse-interaction-test.ts
测试画布中的鼠标交互功能。

**使用方法：**
```javascript
// 在控制台中手动导入并运行
import('./tests/manual/mouse-interaction-test.js').then(module => {
  module.runAllInteractionTests();
});
```

### node-interaction-test.ts
测试神经元节点的创建、选择和拖拽功能。

**使用方法：**
```javascript
// 在控制台中手动导入并运行
import('./tests/manual/node-interaction-test.js').then(module => {
  module.runNodeInteractionTest();
});
```

## 注意事项

- 这些脚本仅用于开发和调试目的
- 运行测试前确保应用已完全加载
- 测试结果会在控制台中显示
- 某些测试可能会修改应用状态，建议测试后刷新页面
