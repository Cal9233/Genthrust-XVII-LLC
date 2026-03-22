/**
 * To-Do Task Reader — Fetch Open Tasks for Cross-Referencing
 * ============================================================
 * Reads Calvin's Microsoft To-Do tasks via the EXISTING delegated auth
 * (getGraphClient from ./index). Only fetches tasks prefixed with [GenThrust]
 * that are not completed.
 *
 * Used by the email intelligence context enricher to cross-reference
 * incoming emails against open tasks — e.g., "You have a task to follow up
 * with Heliparts, and this email may be their response."
 *
 * This module is intentionally fault-tolerant: if To-Do fetching fails
 * for any reason, it returns an empty array rather than blocking email
 * monitoring.
 */

import { getGraphClient } from "./index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TodoTask {
  id: string;
  title: string;
  body: string;
  dueDate: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const GENTHRUST_PREFIX = "[GenThrust]";

/**
 * Get all open (non-completed) To-Do tasks with [GenThrust] prefix.
 *
 * @param userId - The NextAuth user ID for delegated auth token lookup
 * @returns Array of matching tasks. Returns empty array on any error.
 *
 * Uses delegated auth (existing getGraphClient) since the user already
 * has Tasks.ReadWrite scope granted via the web app's Entra ID registration.
 */
export async function getOpenTasks(userId: string): Promise<TodoTask[]> {
  try {
    const client = await getGraphClient(userId);

    // First, get all To-Do lists to find the right one(s)
    const listsResponse = await client.api("/me/todo/lists").get();

    const lists: Array<{ id: string }> = listsResponse.value || [];
    if (lists.length === 0) {
      return [];
    }

    const allTasks: TodoTask[] = [];

    // Query each list for non-completed tasks
    for (const list of lists) {
      try {
        const tasksResponse = await client
          .api(`/me/todo/lists/${list.id}/tasks`)
          .filter("status ne 'completed'")
          .select("id,title,body,dueDateTime,status")
          .top(100)
          .get();

        const tasks: Array<Record<string, unknown>> =
          tasksResponse.value || [];

        for (const task of tasks) {
          const title = (task.title as string) || "";

          // Only include tasks with [GenThrust] prefix
          if (!title.startsWith(GENTHRUST_PREFIX)) continue;

          const bodyContent =
            (task.body as { content?: string })?.content || "";
          const dueDateTime = task.dueDateTime as {
            dateTime?: string;
          } | null;

          allTasks.push({
            id: task.id as string,
            title,
            body: stripHtml(bodyContent),
            dueDate: dueDateTime?.dateTime?.split("T")[0] ?? null,
            status: (task.status as string) || "notStarted",
          });
        }
      } catch (listError) {
        // Per-list error isolation — log and continue with other lists
        console.warn(
          `[todo-reader] Failed to fetch tasks from list ${list.id}:`,
          listError instanceof Error ? listError.message : String(listError)
        );
      }
    }

    return allTasks;
  } catch (error) {
    // Fault-tolerant: log error but don't block email monitoring
    console.warn(
      "[todo-reader] Failed to fetch To-Do tasks — returning empty. Error:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags from task body content.
 * To-Do task bodies can be HTML — we need plain text for matching.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
