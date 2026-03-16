/**
 * Microsoft Graph API helpers for Calendar, To-Do, and Mail operations
 * Ported from Genthrust_Repairs_v.2
 */

import { Client } from "@microsoft/microsoft-graph-client";
import { getGraphClient } from "./index";
import { TokenRefreshError, UserNotConnectedError } from "@/lib/types/graph";
import type { SentEmailResult, GraphMessage } from "@/lib/types/notification";

/**
 * Returns the mailbox path for Graph API calls.
 * Supports shared mailboxes via MS_GRAPH_SHARED_MAILBOX env var.
 */
export function getMailboxPath(): string {
  const sharedMailbox = process.env.MS_GRAPH_SHARED_MAILBOX;
  if (sharedMailbox) {
    return `/users/${sharedMailbox}`;
  }
  return "/me";
}

function handleGraphError(error: unknown, message: string): Error {
  if (
    error instanceof TokenRefreshError ||
    error instanceof UserNotConnectedError
  ) {
    return error;
  }
  console.error(message, error);
  return new Error(
    `${message}: ${error instanceof Error ? error.message : String(error)}`
  );
}

async function getDefaultTaskListId(
  graphClient: Client,
  userId: string
): Promise<string> {
  try {
    const response = await graphClient.api("/me/todo/lists").get();
    const defaultList = response.value.find(
      (list: { wellknownListName?: string; id: string }) =>
        list.wellknownListName === "defaultList"
    );

    if (!defaultList) {
      if (response.value.length > 0) {
        return response.value[0].id;
      }
      throw new Error("No Microsoft To Do lists found for user.");
    }
    return defaultList.id;
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to fetch default To Do list for user ${userId}`
    );
  }
}

/**
 * Creates a calendar event in the user's default calendar
 */
export async function createCalendarEvent(
  userId: string,
  subject: string,
  startTime: Date,
  endTime: Date,
  description: string
): Promise<{ id: string }> {
  const graphClient = await getGraphClient(userId);

  const start = { dateTime: startTime.toISOString(), timeZone: "UTC" };
  const end = { dateTime: endTime.toISOString(), timeZone: "UTC" };

  const event = {
    subject: `[GenThrust RO Reminder] ${subject}`,
    body: {
      contentType: "text",
      content: description,
    },
    start,
    end,
    isAllDay:
      startTime.toDateString() === endTime.toDateString() &&
      startTime.getHours() === 0 &&
      endTime.getHours() === 0,
    reminderMinutesBeforeStart: 60,
  };

  try {
    const result = await graphClient.api("/me/calendar/events").post(event);
    return { id: result.id };
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to create calendar event for user ${userId}`
    );
  }
}

/**
 * Creates a task in the user's default Microsoft To Do list
 */
export async function createToDoTask(
  userId: string,
  title: string,
  dueDate: Date,
  content: string
): Promise<{ id: string }> {
  const graphClient = await getGraphClient(userId);
  const taskListId = await getDefaultTaskListId(graphClient, userId);

  const task = {
    title: `[GenThrust] ${title}`,
    dueDateTime: {
      dateTime: dueDate.toISOString().split("T")[0],
      timeZone: "UTC",
    },
    body: {
      contentType: "text",
      content: content,
    },
    isReminderOn: true,
    reminderDateTime: { dateTime: dueDate.toISOString(), timeZone: "UTC" },
  };

  try {
    const result = await graphClient
      .api(`/me/todo/lists/${taskListId}/tasks`)
      .post(task);
    return { id: result.id };
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to create To Do task for user ${userId}`
    );
  }
}

export interface SendEmailOptions {
  cc?: string;
  replyToMessageId?: string;
}

/**
 * Sends an email from the user's account (or shared mailbox)
 */
export async function sendEmail(
  userId: string,
  to: string,
  subject: string,
  body: string,
  options?: SendEmailOptions
): Promise<SentEmailResult> {
  const graphClient = await getGraphClient(userId);
  const sendTimestamp = new Date().toISOString();
  const sharedMailbox = process.env.MS_GRAPH_SHARED_MAILBOX;

  const message: Record<string, unknown> = {
    subject: `[GenThrust Follow-Up] ${subject}`,
    body: {
      contentType: "HTML",
      content: body,
    },
    toRecipients: [{ emailAddress: { address: to } }],
  };

  if (sharedMailbox) {
    message.from = {
      emailAddress: {
        address: sharedMailbox,
      },
    };
  }

  if (options?.cc) {
    const ccAddresses = options.cc
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
    message.ccRecipients = ccAddresses.map((address) => ({
      emailAddress: { address },
    }));
  }

  try {
    await graphClient
      .api("/me/sendMail")
      .post({ message, saveToSentItems: true });

    const sentMessage = await findSentMessage(graphClient, to, sendTimestamp);
    return sentMessage;
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to send email for user ${userId} to ${to}`
    );
  }
}

async function findSentMessage(
  client: Client,
  toAddress: string,
  afterTimestamp: string,
  maxRetries = 3
): Promise<SentEmailResult> {
  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await new Promise((r) => setTimeout(r, delays[attempt]));

    try {
      const response = await client
        .api("/me/mailFolders/SentItems/messages")
        .filter(`createdDateTime ge ${afterTimestamp}`)
        .orderby("createdDateTime desc")
        .top(10)
        .select(
          "id,conversationId,internetMessageId,toRecipients,createdDateTime"
        )
        .get();

      const match = response.value?.find(
        (msg: {
          toRecipients?: Array<{ emailAddress?: { address?: string } }>;
        }) =>
          msg.toRecipients?.some(
            (r) =>
              r.emailAddress?.address?.toLowerCase() ===
              toAddress.toLowerCase()
          )
      );

      if (match) {
        return {
          messageId: match.id,
          conversationId: match.conversationId,
          internetMessageId: match.internetMessageId,
        };
      }
    } catch (error) {
      console.warn(`findSentMessage attempt ${attempt + 1} failed:`, error);
    }
  }

  throw new Error(`Sent message not found after ${maxRetries} retries`);
}

/**
 * Fetches all messages in a conversation thread
 */
export async function getConversationMessages(
  userId: string,
  conversationId: string
): Promise<GraphMessage[]> {
  const graphClient = await getGraphClient(userId);
  const mailboxPath = getMailboxPath();

  try {
    const response = await graphClient
      .api(`${mailboxPath}/messages`)
      .filter(`conversationId eq '${conversationId}'`)
      .select(
        "id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,sentDateTime,webLink,isDraft"
      )
      .orderby("sentDateTime asc")
      .top(50)
      .get();

    return response.value || [];
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to fetch conversation messages for user ${userId}`
    );
  }
}

/**
 * Creates an email draft in the user's mailbox
 */
export async function createDraftEmail(
  userId: string,
  to: string,
  subject: string,
  body: string
): Promise<{ messageId: string; webLink: string }> {
  const graphClient = await getGraphClient(userId);

  const draft = {
    subject: `[GenThrust DRAFT] ${subject}`,
    body: {
      contentType: "HTML",
      content: body,
    },
    toRecipients: [{ emailAddress: { address: to } }],
  };

  try {
    const result = await graphClient.api("/me/messages").post(draft);
    return { messageId: result.id, webLink: result.webLink };
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to create draft email for user ${userId} to ${to}`
    );
  }
}
