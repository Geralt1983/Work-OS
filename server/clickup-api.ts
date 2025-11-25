const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value?: string | number | boolean | null;
  type_config?: {
    options?: Array<{ id: string; name: string; orderindex: number }>;
  };
}

interface ClickUpTag {
  name: string;
  tag_fg?: string;
  tag_bg?: string;
}

interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: { status: string };
  due_date?: string;
  date_done?: string; // Unix timestamp in ms when task was closed
  date_closed?: string; // Alternative field for closed date
  priority?: { priority: string };
  list: { id: string; name: string };
  custom_fields?: ClickUpCustomField[];
  tags?: ClickUpTag[];
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

interface FolderHierarchy {
  id: string;
  name: string;
  lists: ClickUpList[];
}

interface SpaceHierarchy {
  id: string;
  name: string;
  folders: FolderHierarchy[];
  folderlessLists: ClickUpList[];
}

interface WorkspaceHierarchy {
  teamId: string;
  spaces: SpaceHierarchy[];
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
    tags?: string[];
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

  async addTagToTask(taskId: string, tagName: string): Promise<void> {
    await this.request(`/task/${taskId}/tag/${encodeURIComponent(tagName)}`, {
      method: "POST",
    });
  }

  async removeTagFromTask(taskId: string, tagName: string): Promise<void> {
    await this.request(`/task/${taskId}/tag/${encodeURIComponent(tagName)}`, {
      method: "DELETE",
    });
  }

  async getSpaceTags(spaceId: string): Promise<ClickUpTag[]> {
    const data = await this.request(`/space/${spaceId}/tag`);
    return data.tags || [];
  }

  async createSpaceTag(spaceId: string, tag: { name: string; tag_bg?: string; tag_fg?: string }): Promise<void> {
    await this.request(`/space/${spaceId}/tag`, {
      method: "POST",
      body: JSON.stringify({ tag }),
    });
  }

  async getList(listId: string): Promise<ClickUpList & { space?: { id: string } }> {
    return this.request(`/list/${listId}`);
  }

  async batchTagTasksInList(listId: string, tagName: string): Promise<{ tagged: number; skipped: number }> {
    const tasks = await this.getTasks(listId);
    let tagged = 0;
    let skipped = 0;

    for (const task of tasks) {
      const hasTag = task.tags?.some(t => t.name.toLowerCase() === tagName.toLowerCase());
      if (hasTag) {
        skipped++;
        continue;
      }
      try {
        await this.addTagToTask(task.id, tagName);
        tagged++;
      } catch (e) {
        console.error(`Failed to tag task ${task.id}:`, e);
        skipped++;
      }
    }

    return { tagged, skipped };
  }

  async deleteTask(taskId: string): Promise<void> {
    const response = await fetch(`${CLICKUP_API_BASE}/task/${taskId}`, {
      method: "DELETE",
      headers: {
        "Authorization": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ClickUp API error: ${response.status} - ${error}`);
    }
    // DELETE returns empty response, don't try to parse JSON
  }

  async getListCustomFields(listId: string): Promise<ClickUpCustomField[]> {
    const data = await this.request(`/list/${listId}/field`);
    return data.fields || [];
  }

  async setCustomFieldValue(taskId: string, fieldId: string, value: string | number | boolean): Promise<void> {
    await this.request(`/task/${taskId}/field/${fieldId}`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });
  }

  async findTierFieldId(listId: string): Promise<string | null> {
    const fields = await this.getListCustomFields(listId);
    // Match field names that contain "tier" (handles emoji prefixes like "⛰️ Tier")
    const tierField = fields.find(f => f.name.toLowerCase().includes("tier"));
    return tierField?.id || null;
  }

  getTierValueFromTask(task: ClickUpTask): string | null {
    if (!task.custom_fields) return null;
    // Match field names that contain "tier" (handles emoji prefixes like "⛰️ Tier")
    const tierField = task.custom_fields.find(f => f.name.toLowerCase().includes("tier"));
    if (!tierField || tierField.value === null || tierField.value === undefined) return null;
    
    // Handle dropdown type - value can be option ID (string) or orderindex (number)
    if (tierField.type === "drop_down" && tierField.type_config?.options) {
      const value = tierField.value;
      
      // Try matching by orderindex first (ClickUp sometimes returns orderindex as value)
      if (typeof value === "number") {
        const option = tierField.type_config.options.find(o => o.orderindex === value);
        return option?.name?.toLowerCase() || null;
      }
      
      // Try matching by option ID (string)
      const optionId = String(value);
      const option = tierField.type_config.options.find(o => o.id === optionId);
      return option?.name?.toLowerCase() || null;
    }
    
    return String(tierField.value).toLowerCase();
  }

  async getTierFieldWithOptions(listId: string): Promise<{ fieldId: string; options: Map<string, string> } | null> {
    const fields = await this.getListCustomFields(listId);
    // Match field names that contain "tier" (handles emoji prefixes like "⛰️ Tier")
    const tierField = fields.find(f => f.name.toLowerCase().includes("tier"));
    
    if (!tierField) return null;
    
    const options = new Map<string, string>();
    if (tierField.type_config?.options) {
      for (const opt of tierField.type_config.options) {
        // Map tier name (lowercase) to option ID
        options.set(opt.name.toLowerCase(), opt.id);
      }
    }
    
    return { fieldId: tierField.id, options };
  }

  async getAllWorkspaceTasks(options?: {
    statuses?: string[];
    include_closed?: boolean;
    subtasks?: boolean;
    date_done_gt?: number; // Unix timestamp in ms - filter tasks completed after this date
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
    if (options?.date_done_gt) {
      params.append("date_done_gt", options.date_done_gt.toString());
    }
    
    const data = await this.request(`/team/${this.teamId}/task?${params.toString()}`);
    return data.tasks;
  }

  async getRecentlyCompletedTasks(sinceDate?: Date): Promise<ClickUpTask[]> {
    // Default to start of today if no date provided
    const since = sinceDate || new Date(new Date().setHours(0, 0, 0, 0));
    
    // Fetch all closed tasks since the given date
    const allTasks = await this.getAllWorkspaceTasks({
      include_closed: true,
      date_done_gt: since.getTime(),
    });
    
    // Filter to only tasks that have a date_done (completed tasks)
    return allTasks.filter(task => {
      const dateDone = task.date_done || task.date_closed;
      if (!dateDone) return false;
      
      const completedAt = parseInt(dateDone, 10);
      return completedAt >= since.getTime();
    });
  }

  async searchTasks(query: string): Promise<ClickUpTask[]> {
    const allTasks = await this.getAllWorkspaceTasks({ include_closed: false });
    const lowerQuery = query.toLowerCase();
    return allTasks.filter(task => 
      task.name.toLowerCase().includes(lowerQuery) ||
      (task.description && task.description.toLowerCase().includes(lowerQuery))
    );
  }

  async getFullHierarchy(): Promise<WorkspaceHierarchy> {
    const spaces = await this.getSpaces();
    const hierarchy: WorkspaceHierarchy = {
      teamId: this.teamId,
      spaces: [],
    };

    for (const space of spaces) {
      const spaceData: SpaceHierarchy = {
        id: space.id,
        name: space.name,
        folders: [],
        folderlessLists: [],
      };

      try {
        const folders = await this.getFolders(space.id);
        for (const folder of folders) {
          const folderData: FolderHierarchy = {
            id: folder.id,
            name: folder.name,
            lists: folder.lists || [],
          };
          
          if (!folder.lists || folder.lists.length === 0) {
            try {
              const lists = await this.getLists(folder.id);
              folderData.lists = lists;
            } catch (e) {
              console.error(`Error fetching lists for folder ${folder.id}:`, e);
            }
          }
          
          spaceData.folders.push(folderData);
        }
      } catch (e) {
        console.error(`Error fetching folders for space ${space.id}:`, e);
      }

      try {
        const folderlessLists = await this.getFolderlessLists(space.id);
        spaceData.folderlessLists = folderlessLists;
      } catch (e) {
        console.error(`Error fetching folderless lists for space ${space.id}:`, e);
      }

      hierarchy.spaces.push(spaceData);
    }

    return hierarchy;
  }
}

export const clickupApi = new ClickUpAPI();

export const clickupTools = [
  {
    name: "get_hierarchy",
    description: "Get the complete workspace hierarchy: all spaces, their folders, and all lists. Use this to understand the full structure of ClickUp.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_spaces",
    description: "Get all spaces in the ClickUp workspace",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_folders",
    description: "Get all folders in a space",
    parameters: {
      type: "object",
      properties: {
        space_id: { type: "string", description: "The space ID" },
      },
      required: ["space_id"],
    },
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
    name: "get_folderless_lists",
    description: "Get lists that are directly in a space (not in any folder)",
    parameters: {
      type: "object",
      properties: {
        space_id: { type: "string", description: "The space ID" },
      },
      required: ["space_id"],
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
    description: "Create a new task in a list. Auto-tags with the client/list name for dashboard tracking.",
    parameters: {
      type: "object",
      properties: {
        list_id: { type: "string", description: "The list ID to create the task in" },
        name: { type: "string", description: "Task name" },
        description: { type: "string", description: "Task description" },
        due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
        priority: { type: "number", description: "Priority (1=urgent, 2=high, 3=normal, 4=low)" },
        tags: { type: "array", items: { type: "string" }, description: "Additional tags to add to the task" },
        auto_tag_client: { type: "boolean", description: "Auto-add the list name as a tag (default: true)" },
      },
      required: ["list_id", "name"],
    },
  },
  {
    name: "batch_tag_list",
    description: "Tag all tasks in a list with the client/list name. Use this to prepare existing tasks for ClickUp dashboard filtering.",
    parameters: {
      type: "object",
      properties: {
        list_id: { type: "string", description: "The list ID to tag all tasks in" },
        tag_name: { type: "string", description: "Tag name to add (defaults to list name if not specified)" },
      },
      required: ["list_id"],
    },
  },
  {
    name: "add_tag_to_task",
    description: "Add a tag to an existing task",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID" },
        tag_name: { type: "string", description: "The tag name to add" },
      },
      required: ["task_id", "tag_name"],
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
    case "get_hierarchy":
      return clickupApi.getFullHierarchy();
    
    case "get_spaces":
      return clickupApi.getSpaces();
    
    case "get_folders":
      return clickupApi.getFolders(args.space_id as string);
    
    case "get_lists":
      return clickupApi.getLists(args.folder_id as string);
    
    case "get_folderless_lists":
      return clickupApi.getFolderlessLists(args.space_id as string);
    
    case "get_tasks":
      return clickupApi.getTasks(args.list_id as string);
    
    case "get_all_tasks":
      return clickupApi.getAllWorkspaceTasks({
        include_closed: args.include_closed as boolean,
      });
    
    case "search_tasks":
      return clickupApi.searchTasks(args.query as string);
    
    case "create_task": {
      const listId = args.list_id as string;
      const dueDate = args.due_date 
        ? new Date(args.due_date as string).getTime()
        : undefined;
      
      // Build tags array
      const tags: string[] = args.tags as string[] || [];
      
      // Auto-tag with client/list name unless explicitly disabled
      const autoTagClient = args.auto_tag_client !== false;
      if (autoTagClient) {
        try {
          const list = await clickupApi.getList(listId);
          const clientTag = list.name;
          if (clientTag && !tags.includes(clientTag)) {
            tags.push(clientTag);
          }
        } catch (e) {
          console.error("Failed to get list name for auto-tagging:", e);
        }
      }
      
      const task = await clickupApi.createTask(listId, {
        name: args.name as string,
        description: args.description as string,
        due_date: dueDate,
        priority: args.priority as number,
        tags: tags.length > 0 ? tags : undefined,
      });
      
      return {
        ...task,
        autoTagged: tags,
        message: tags.length > 0 ? `Created task with tags: ${tags.join(", ")}` : "Created task",
      };
    }
    
    case "batch_tag_list": {
      const listId = args.list_id as string;
      let tagName = args.tag_name as string;
      
      // Default to list name if no tag specified
      if (!tagName) {
        const list = await clickupApi.getList(listId);
        tagName = list.name;
      }
      
      const result = await clickupApi.batchTagTasksInList(listId, tagName);
      return {
        success: true,
        tagName,
        tasksTagged: result.tagged,
        tasksSkipped: result.skipped,
        message: `Tagged ${result.tagged} tasks with "${tagName}" (${result.skipped} already had the tag)`,
      };
    }
    
    case "add_tag_to_task": {
      await clickupApi.addTagToTask(args.task_id as string, args.tag_name as string);
      return { success: true, message: `Added tag "${args.tag_name}" to task` };
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
