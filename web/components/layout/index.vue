<template>
    <html lang="zh-CN">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta name="theme-color" content="#0f172a" />
            <meta name="description" content="Chat Web Skyline 服务端渲染技术验证页" />
            <title>Chat Web Skyline</title>
            <slot name="injectHeader" />
        </head>
        <body>
            <slot name="content" />
        </body>
    </html>
</template>
