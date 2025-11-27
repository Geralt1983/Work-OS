"use client"

import { motion } from "framer-motion"
import { CheckSquare2, ListTodo, Settings } from "lucide-react"

interface SidebarProps {
  activeSection: string
  setActiveSection: (section: string) => void
}

export function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
  const navItems = [
    { id: "tasks", label: "Tasks", icon: CheckSquare2 },
    { id: "lists", label: "Lists", icon: ListTodo },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-20 bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col items-center py-8 gap-8 fixed h-full z-20 left-0 top-0"
    >
      {/* Logo */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center cursor-pointer shadow-lg"
      >
        <span className="font-black text-white text-lg">W</span>
      </motion.div>

      {/* Navigation */}
      <nav className="flex flex-col gap-4 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id

          return (
            <motion.button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                isActive
                  ? "bg-gradient-to-br from-purple-500 to-cyan-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon size={24} />
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute inset-0 rounded-2xl border border-white/20 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* User profile */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center cursor-pointer border border-white/10 hover:border-white/20 transition-all"
      >
        <div className="w-8 h-8 rounded-lg bg-slate-600 flex items-center justify-center text-white font-semibold">
          JD
        </div>
      </motion.div>
    </motion.div>
  )
}
