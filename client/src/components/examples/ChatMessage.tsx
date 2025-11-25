import ChatMessage from "../ChatMessage";

export default function ChatMessageExample() {
  return (
    <div className="space-y-4 p-4 bg-background">
      <ChatMessage
        role="user"
        content="Create a task to review the Q1 marketing strategy"
        timestamp={new Date()}
      />
      <ChatMessage
        role="assistant"
        content="I've created the task for you. Here are the details:"
        timestamp={new Date()}
        taskCard={{
          title: "Review Q1 marketing strategy",
          taskId: "TASK-1234",
          status: "To Do",
          dueDate: "Dec 15, 2025",
        }}
      />
    </div>
  );
}
