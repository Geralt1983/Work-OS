"use client"

import { motion } from "framer-motion"
import { Search, Bell, Plus } from "lucide-react"

export function TopBar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="px-8 py-6 flex items-center justify-between border-b border-white/5"
    >
      <div className="flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-balance">
          <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">Work OS</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">Manage your tasks with futuristic flair</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
        >
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-32"
          />
        </motion.div>

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="relative p-2 rounded-xl hover:bg-white/10 transition-all"
        >
          <Bell size={20} className="text-slate-400" />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-500"
          />
        </motion.button>

        {/* Add task button */}
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">New Task</span>
        </motion.button>
      </div>
    </motion.div>
  )
}
