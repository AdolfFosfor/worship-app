<template>
  <NuxtLayout>
    <!-- Кэш страниц: назад/свайп без remount и без вспышки loading -->
    <NuxtPage :keepalive="{ max: 16 }" />
  </NuxtLayout>
</template>
