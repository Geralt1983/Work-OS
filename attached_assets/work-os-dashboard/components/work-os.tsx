"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { TaskKanban } from "./task-kanban"
import { Sidebar } from "./sidebar"
import { TopBar } from "./top-bar"

export function WorkOS() {
  const [activeSection, setActiveSection] = useState("tasks")

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-[#0f0f1a] via-[#16213e] to-[#0f0f1a]">
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 via-transparent to-cyan-900/10 opacity-50" />

      {/* Main layout */}
      <div className="relative z-10 flex h-full">
        {/* Sidebar */}
        <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />

        {/* Main content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex-1 flex flex-col"
        >
          <TopBar />

          {/* Floating island container */}
          <div className="flex-1 p-6 flex items-center justify-center">
            <motion.div
              layoutId="floating-island"
              className="w-full h-full max-w-7xl rounded-3xl bg-gradient-to-br from-slate-900/40 via-slate-900/30 to-purple-900/20 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
            >
              {/* Inner glow border */}
              <div className="absolute inset-0 rounded-3xl border border-white/5 pointer-events-none" />

              {/* Content */}
              <div className="relative z-10 h-full overflow-y-auto">{activeSection === "tasks" && <TaskKanban />}</div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
