"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { TaskColumn } from "./task-column"

export function TaskKanban() {
  const [tasks, setTasks] = useState({
    active: [
      {
        id: "TASK-001",
        title: "Design new dashboard",
        description: "Create wireframes and high-fidelity mockups",
        priority: "high",
        dueDate: "Tomorrow",
      },
      {
        id: "TASK-002",
        title: "Implement API integration",
        description: "Connect backend with frontend",
        priority: "high",
        dueDate: "Dec 2",
      },
    ],
    queued: [
      {
        id: "TASK-003",
        title: "Review pull requests",
        description: "Check pending code reviews",
        priority: "medium",
        dueDate: "Dec 3",
      },
      {
        id: "TASK-004",
        title: "Write documentation",
        description: "Update API docs and guides",
        priority: "medium",
        dueDate: "Dec 4",
      },
    ],
    backlog: [
      {
        id: "TASK-005",
        title: "Performance optimization",
        description: "Optimize bundle size and load times",
        priority: "low",
        dueDate: "Dec 10",
      },
      {
        id: "TASK-006",
        title: "Add dark mode",
        description: "Implement theme switching",
        priority: "low",
        dueDate: "Dec 15",
      },
    ],
  })

  const handleTaskComplete = (taskId: string) => {
    // Create confetti
    createConfetti()

    // Remove task (or move to completed)
    setTasks((prev) => ({
      ...prev,
      active: prev.active.filter((t) => t.id !== taskId),
      queued: prev.queued.filter((t) => t.id !== taskId),
      backlog: prev.backlog.filter((t) => t.id !== taskId),
    }))
  }

  return (
    <div className="h-full flex flex-col p-8">
      <div className="flex-1">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full"
        >
          <TaskColumn
            title="Active"
            subtitle="Currently working"
            color="purple"
            tasks={tasks.active}
            onTaskComplete={handleTaskComplete}
          />
          <TaskColumn
            title="Queued"
            subtitle="Ready to start"
            color="cyan"
            tasks={tasks.queued}
            onTaskComplete={handleTaskComplete}
          />
          <TaskColumn
            title="Backlog"
            subtitle="Future tasks"
            color="slate"
            tasks={tasks.backlog}
            onTaskComplete={handleTaskComplete}
          />
        </motion.div>
      </div>
    </div>
  )
}

function createConfetti() {
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement("div")
    confetti.className = "confetti"
    confetti.style.left = Math.random() * window.innerWidth + "px"
    confetti.style.top = "0px"
    confetti.style.backgroundColor = ["#8b5cf6", "#06b6d4", "#a78bfa", "#0ea5e9"][Math.floor(Math.random() * 4)]
    confetti.style.animationDelay = Math.random() * 0.3 + "s"

    if (Math.random() > 0.5) {
      confetti.classList.add("spin")
    }

    document.body.appendChild(confetti)

    setTimeout(() => confetti.remove(), 2800)
  }
}
