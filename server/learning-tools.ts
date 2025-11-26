import OpenAI from 'openai';
import { storage } from './storage';

export const LEARNING_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'record_signal',
      description: 'Record a behavioral signal about a task or user state. Use this to capture psychological patterns like anxiety, starting difficulty, energy levels, and work preferences. These signals help learn the user\'s work patterns over time.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'Move/task ID (optional)' },
          task_name: { type: 'string', description: 'Task name for reference' },
          client_name: { type: 'string', description: 'Client this task belongs to' },
          signal_type: { 
            type: 'string', 
            enum: ['deferred', 'avoided', 'completed_fast', 'struggled', 'excited', 'anxiety', 'starting_difficulty', 'needs_breakdown', 'energized', 'drained'],
            description: 'Signal type: deferred (pushed to later), avoided (skipped), completed_fast (done quickly), struggled (took effort), excited (enthusiasm), anxiety (felt anxious), starting_difficulty (trouble getting started), needs_breakdown (task too big), energized (gave energy), drained (energy-draining)'
          },
          context: { type: 'string', description: 'Any relevant context about why this happened' },
          time_window_minutes: { type: 'number', description: 'How much time was available when this happened (e.g., 20 for a quick slot, 120 for a big block)' },
          energy_level: { 
            type: 'string', 
            enum: ['high', 'medium', 'low'],
            description: 'User\'s energy level at the time'
          }
        },
        required: ['signal_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'record_pattern',
      description: 'Record a learned pattern about the user. Use this when you notice consistent behaviors like productivity times, preferences, or avoidance patterns.',
      parameters: {
        type: 'object',
        properties: {
          pattern_type: {
            type: 'string',
            enum: ['productivity', 'energy', 'preference', 'avoidance'],
            description: 'Category: productivity (time-based patterns), energy (energy patterns), preference (work style preferences), avoidance (things they avoid)'
          },
          pattern_key: { 
            type: 'string', 
            description: 'Unique identifier like "morning_person", "avoids_admin_tasks", "prefers_creative_first"' 
          },
          pattern_value: { 
            type: 'object',
            description: 'Structured data about the pattern'
          }
        },
        required: ['pattern_type', 'pattern_key']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_client_sentiment',
      description: 'Set how the user feels about a specific client. Use when user expresses feelings about a client.',
      parameters: {
        type: 'object',
        properties: {
          client_name: { type: 'string', description: 'Name of the client' },
          sentiment: { 
            type: 'string', 
            enum: ['positive', 'neutral', 'negative', 'complicated'],
            description: 'Overall sentiment: positive (enjoy working with), neutral (no strong feelings), negative (frustrating), complicated (mixed feelings)'
          },
          reason: { type: 'string', description: 'Brief reason for this sentiment' }
        },
        required: ['client_name', 'sentiment']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_client_importance',
      description: 'Set the importance/priority level of a client. Use when user indicates client priority.',
      parameters: {
        type: 'object',
        properties: {
          client_name: { type: 'string', description: 'Name of the client' },
          importance: { 
            type: 'string', 
            enum: ['high', 'medium', 'low'],
            description: 'Importance level: high (top priority, VIP), medium (standard), low (less urgent)'
          },
          reason: { type: 'string', description: 'Brief reason for this importance level' }
        },
        required: ['client_name', 'importance']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_learned_patterns',
      description: 'Get all learned patterns about user behavior. Use this to personalize recommendations.',
      parameters: {
        type: 'object',
        properties: {
          pattern_type: { 
            type: 'string', 
            enum: ['productivity', 'energy', 'preference', 'avoidance', 'all'],
            description: 'Filter by pattern type, or "all" for everything'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_avoided_tasks',
      description: 'Get tasks that have been repeatedly deferred or avoided. Use to identify patterns of avoidance.',
      parameters: {
        type: 'object',
        properties: {
          days_back: { 
            type: 'number', 
            description: 'How many days to look back (default: 14)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_productivity_insights',
      description: 'Get productivity patterns by time of day. Shows when user is most/least productive based on task completions vs deferrals.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_client_insights',
      description: 'Get all learned information about clients including sentiment, importance, avoidance scores, and patterns.',
      parameters: {
        type: 'object',
        properties: {
          client_name: { type: 'string', description: 'Specific client name (optional, returns all if not specified)' }
        }
      }
    }
  }
];

export async function executeLearningTool(
  functionName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (functionName) {
      case 'record_signal': {
        const signal = await storage.recordSignal({
          taskId: args.task_id as string | undefined,
          taskName: args.task_name as string | undefined,
          clientName: args.client_name as string | undefined,
          signalType: args.signal_type as string,
          context: args.context as string | undefined,
          timeWindowMinutes: args.time_window_minutes as number | undefined,
          energyLevel: args.energy_level as string | undefined
        });
        return JSON.stringify({
          success: true,
          message: `Recorded ${args.signal_type} signal`,
          signal_id: signal.id
        });
      }

      case 'record_pattern': {
        const pattern = await storage.recordPattern({
          patternType: args.pattern_type as string,
          patternKey: args.pattern_key as string,
          patternValue: args.pattern_value as Record<string, unknown> | undefined
        });
        return JSON.stringify({
          success: true,
          message: `Recorded pattern: ${args.pattern_key}`,
          confidence: pattern.confidence
        });
      }

      case 'set_client_sentiment': {
        const clientName = args.client_name as string;
        await storage.upsertClientMemory({
          clientName,
          sentiment: args.sentiment as string
        });
        
        // Also record as a pattern for learning
        await storage.recordPattern({
          patternType: 'preference',
          patternKey: `client_sentiment_${clientName.toLowerCase()}`,
          patternValue: { sentiment: args.sentiment, reason: args.reason }
        });
        
        return JSON.stringify({
          success: true,
          message: `Set ${clientName} sentiment to ${args.sentiment}`
        });
      }

      case 'set_client_importance': {
        const clientName = args.client_name as string;
        await storage.upsertClientMemory({
          clientName,
          importance: args.importance as string
        });
        
        return JSON.stringify({
          success: true,
          message: `Set ${clientName} importance to ${args.importance}`
        });
      }

      case 'get_learned_patterns': {
        const patternType = args.pattern_type as string | undefined;
        const patterns = await storage.getPatterns(
          patternType === 'all' ? undefined : patternType
        );
        
        if (patterns.length === 0) {
          return JSON.stringify({
            patterns: [],
            message: 'No patterns learned yet. Patterns are captured as you work and express preferences.'
          });
        }
        
        return JSON.stringify({
          patterns: patterns.map(p => ({
            type: p.patternType,
            key: p.patternKey,
            value: p.patternValue,
            confidence: p.confidence,
            last_observed: p.lastObserved
          }))
        });
      }

      case 'get_avoided_tasks': {
        const daysBack = (args.days_back as number) || 14;
        const avoided = await storage.getAvoidedTasks(daysBack);
        
        if (avoided.length === 0) {
          return JSON.stringify({
            avoided_tasks: [],
            message: 'No avoided tasks found. Keep working and patterns will emerge.'
          });
        }
        
        return JSON.stringify({
          avoided_tasks: avoided,
          summary: `Found ${avoided.length} tasks that have been deferred multiple times in the last ${daysBack} days`
        });
      }

      case 'get_productivity_insights': {
        const hourlyStats = await storage.getProductivityByHour();
        
        // Find best and worst hours
        const withRatio = hourlyStats.map(h => ({
          ...h,
          ratio: h.completions + h.deferrals > 0 
            ? h.completions / (h.completions + h.deferrals) 
            : 0.5
        }));
        
        const bestHours = withRatio
          .filter(h => h.completions + h.deferrals >= 2)
          .sort((a, b) => b.ratio - a.ratio)
          .slice(0, 3);
        
        const worstHours = withRatio
          .filter(h => h.completions + h.deferrals >= 2)
          .sort((a, b) => a.ratio - b.ratio)
          .slice(0, 3);
        
        const formatHour = (h: number) => {
          if (h === 0) return '12am';
          if (h === 12) return '12pm';
          return h < 12 ? `${h}am` : `${h-12}pm`;
        };
        
        return JSON.stringify({
          hourly_stats: hourlyStats,
          best_hours: bestHours.map(h => ({ hour: formatHour(h.hour), completions: h.completions, deferrals: h.deferrals })),
          worst_hours: worstHours.map(h => ({ hour: formatHour(h.hour), completions: h.completions, deferrals: h.deferrals })),
          insights: bestHours.length > 0 
            ? `You're most productive around ${bestHours.map(h => formatHour(h.hour)).join(', ')}`
            : 'Not enough data yet to determine productivity patterns'
        });
      }

      case 'get_client_insights': {
        const clientName = args.client_name as string | undefined;
        
        if (clientName) {
          const client = await storage.getClientMemory(clientName);
          if (!client) {
            return JSON.stringify({ error: `Client "${clientName}" not found in memory` });
          }
          
          const signals = await storage.getTaskSignals(undefined, clientName, undefined, 30);
          const signalSummary = signals.reduce((acc, s) => {
            acc[s.signalType] = (acc[s.signalType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          return JSON.stringify({
            client: {
              name: client.clientName,
              tier: client.tier,
              sentiment: client.sentiment,
              importance: client.importance,
              avoidance_score: client.avoidanceScore,
              total_moves: client.totalMoves,
              stale_days: client.staleDays,
              last_move: client.lastMoveDescription,
              notes: client.notes
            },
            recent_signals: signalSummary
          });
        }
        
        // Return all clients with insights
        const clients = await storage.getAllClients();
        return JSON.stringify({
          clients: clients.map(c => ({
            name: c.clientName,
            tier: c.tier,
            sentiment: c.sentiment,
            importance: c.importance,
            avoidance_score: c.avoidanceScore,
            stale_days: c.staleDays
          }))
        });
      }

      default:
        return JSON.stringify({ error: `Unknown learning tool: ${functionName}` });
    }
  } catch (error) {
    console.error(`Learning tool error (${functionName}):`, error);
    return JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
