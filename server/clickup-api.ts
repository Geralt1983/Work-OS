const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: { status: string };
  due_date?: string;
  priority?: { priority: string };
  list: { id: string; name: string };
}

interface ClickUpList {
  id: string;
  name: string;
}

interface ClickUpSpace {
  id: string;
  name: string;
}

interface ClickUpFolder {
  id: string;
  name: string;
  lists: ClickUpList[];
}

class ClickUpAPI {
  private apiKey: string;
  private teamId: string;

  constructor() {
    this.apiKey = process.env.CLICKUP_API_KEY || "";
    this.teamId = process.env.CLICKUP_TEAM_ID || "";
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${CLICKUP_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ClickUp API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getSpaces(): Promise<ClickUpSpace[]> {
    const data = await this.request(`/team/${this.teamId}/space?archived=false`);
    return data.spaces;
  }

  async getFolders(spaceId: string): Promise<ClickUpFolder[]> {
    const data = await this.request(`/space/${spaceId}/folder?archived=false`);
    return data.folders;
  }

  async getLists(folderId: string): Promise<ClickUpList[]> {
    const data = await this.request(`/folder/${folderId}/list?archived=false`);
    return data.lists;
  }

  async getFolderlessLists(spaceId: string): Promise<ClickUpList[]> {
    const data = await this.request(`/space/${spaceId}/list?archived=false`);
    return data.lists;
  }

  async getTask(taskId: string): Promise<ClickUpTask> {
    return this.request(`/task/${taskId}`);
  }

  async getTasks(listId: string): Promise<ClickUpTask[]> {
    const data = await this.request(`/list/${listId}/task?archived=false`);
    return data.tasks;
  }

  async createTask(listId: string, data: {
    name: string;
    description?: string;
    due_date?: number;
    priority?: number;
  }): Promise<ClickUpTask> {
    return this.request(`/list/${listId}/task`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(taskId: string, data: {
    name?: string;
    description?: string;
    status?: string;
    due_date?: number;
    priority?: number;
  }): Promise<ClickUpTask> {
    return this.request(`/task/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.request(`/task/${taskId}`, {
      method: "DELETE",
    });
  }

  async getAllWorkspaceTasks(options?: {
    statuses?: string[];
    include_closed?: boolean;
    subtasks?: boolean;
  }): Promise<ClickUpTask[]> {
    const params = new URLSearchParams();
    if (options?.statuses) {
      options.statuses.forEach(s => params.append("statuses[]", s));
    }
    if (options?.include_closed) {
      params.append("include_closed", "true");
    }
    if (options?.subtasks) {
      params.append("subtasks", "true");
    }
    
    const data = await this.request(`/team/${this.teamId}/task?${params.toString()}`);
    return data.tasks;
  }

  async searchTasks(query: string): Promise<ClickUpTask[]> {
    const allTasks = await this.getAllWorkspaceTasks({ include_closed: false });
    const lowerQuery = query.toLowerCase();
    return allTasks.filter(task => 
      task.name.toLowerCase().includes(lowerQuery) ||
      (task.description && task.description.toLowerCase().includes(lowerQuery))
    );
  }
}

export const clickupApi = new ClickUpAPI();

export const clickupTools = [
  {
    name: "get_spaces",
    description: "Get all spaces in the ClickUp workspace",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_lists",
    description: "Get all lists in a folder",
    parameters: {
      type: "object",
      properties: {
        folder_id: { type: "string", description: "The folder ID" },
      },
      required: ["folder_id"],
    },
  },
  {
    name: "get_tasks",
    description: "Get all tasks in a list",
    parameters: {
      type: "object",
      properties: {
        list_id: { type: "string", description: "The list ID" },
      },
      required: ["list_id"],
    },
  },
  {
    name: "get_all_tasks",
    description: "Get all tasks across the entire workspace",
    parameters: {
      type: "object",
      properties: {
        include_closed: { type: "boolean", description: "Include closed tasks" },
      },
    },
  },
  {
    name: "search_tasks",
    description: "Search for tasks by name or description",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task in a list",
    parameters: {
      type: "object",
      properties: {
        list_id: { type: "string", description: "The list ID to create the task in" },
        name: { type: "string", description: "Task name" },
        description: { type: "string", description: "Task description" },
        due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
        priority: { type: "number", description: "Priority (1=urgent, 2=high, 3=normal, 4=low)" },
      },
      required: ["list_id", "name"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID" },
        name: { type: "string", description: "New task name" },
        description: { type: "string", description: "New task description" },
        status: { type: "string", description: "New task status" },
        due_date: { type: "string", description: "New due date in YYYY-MM-DD format" },
        priority: { type: "number", description: "New priority (1=urgent, 2=high, 3=normal, 4=low)" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID to delete" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "get_task",
    description: "Get details of a specific task",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID" },
      },
      required: ["task_id"],
    },
  },
];

export async function executeClickUpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_spaces":
      return clickupApi.getSpaces();
    
    case "get_folders":
      return clickupApi.getFolders(args.space_id as string);
    
    case "get_lists":
      return clickupApi.getLists(args.folder_id as string);
    
    case "get_tasks":
      return clickupApi.getTasks(args.list_id as string);
    
    case "get_all_tasks":
      return clickupApi.getAllWorkspaceTasks({
        include_closed: args.include_closed as boolean,
      });
    
    case "search_tasks":
      return clickupApi.searchTasks(args.query as string);
    
    case "create_task": {
      const dueDate = args.due_date 
        ? new Date(args.due_date as string).getTime()
        : undefined;
      return clickupApi.createTask(args.list_id as string, {
        name: args.name as string,
        description: args.description as string,
        due_date: dueDate,
        priority: args.priority as number,
      });
    }
    
    case "update_task": {
      const updateData: Record<string, unknown> = {};
      if (args.name) updateData.name = args.name;
      if (args.description) updateData.description = args.description;
      if (args.status) updateData.status = args.status;
      if (args.due_date) updateData.due_date = new Date(args.due_date as string).getTime();
      if (args.priority) updateData.priority = args.priority;
      return clickupApi.updateTask(args.task_id as string, updateData);
    }
    
    case "delete_task":
      await clickupApi.deleteTask(args.task_id as string);
      return { success: true, message: "Task deleted successfully" };
    
    case "get_task":
      return clickupApi.getTask(args.task_id as string);
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
