<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
    <nav class="bg-black/50 backdrop-blur-md border-b border-white/10">
      <div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 class="text-2xl font-bold text-white">HighLevel Builder</h1>
        <div class="flex gap-4">
          <router-link
            to="/login"
            class="px-6 py-2 text-white hover:bg-white/10 rounded-lg transition"
          >
            Sign In
          </router-link>
          <router-link
            to="/signup"
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Sign Up
          </router-link>
        </div>
      </div>
    </nav>

    <main class="max-w-6xl mx-auto px-6 py-20">
      <div class="text-center space-y-8">
        <h2 class="text-5xl font-bold text-white">
          Build HighLevel Apps with AI
        </h2>
        <p class="text-xl text-gray-300 max-w-2xl mx-auto">
          Describe what you want in natural language. Our AI generates fully functional HighLevel
          marketplace apps that integrate with Contacts, Conversations, and Calendar APIs.
        </p>

        <div class="flex justify-center gap-4">
          <router-link
            to="/signup"
            class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            Get Started
          </router-link>
          <a
            href="#features"
            class="px-8 py-3 border border-white/30 text-white hover:bg-white/10 font-medium rounded-lg transition"
          >
            Learn More
          </a>
        </div>

        <div class="pt-12">
          <div class="bg-white/5 border border-white/10 rounded-lg p-8">
            <p class="text-gray-400 mb-8">✨ Features</p>
            <div class="grid md:grid-cols-3 gap-8">
              <div class="space-y-2">
                <h3 class="text-white font-semibold">AI Generation</h3>
                <p class="text-gray-400 text-sm">
                  Describe your app idea in plain English. Our AI generates production-ready code.
                </p>
              </div>
              <div class="space-y-2">
                <h3 class="text-white font-semibold">Real HighLevel APIs</h3>
                <p class="text-gray-400 text-sm">
                  Generated apps talk to real HighLevel endpoints. Works in sandbox and production.
                </p>
              </div>
              <div class="space-y-2">
                <h3 class="text-white font-semibold">Version Control</h3>
                <p class="text-gray-400 text-sm">
                  Every generation creates a snapshot. Restore any previous version instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
</script>
