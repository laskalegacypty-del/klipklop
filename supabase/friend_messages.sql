-- Friend-to-friend direct messages
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS friend_messages (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message_text  text,
  message_type  text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'times_share', 'video_share')),
  attachment_url  text,
  -- For times_share: { horse_name, game, time_seconds, level, qualifier_name }
  -- For video_share: { title, video_url, horse_name }
  attachment_meta jsonb,
  read_at       timestamptz,
  created_at    timestamptz DEFAULT now() NOT NULL
);

-- Index for fast conversation lookup
CREATE INDEX IF NOT EXISTS friend_messages_conversation_idx
  ON friend_messages (
    LEAST(sender_id::text, receiver_id::text),
    GREATEST(sender_id::text, receiver_id::text),
    created_at DESC
  );

-- Index for unread count
CREATE INDEX IF NOT EXISTS friend_messages_unread_idx
  ON friend_messages (receiver_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE friend_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: only parties in the conversation
CREATE POLICY "Users can read own messages"
  ON friend_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- INSERT: sender must be the authenticated user
CREATE POLICY "Users can send messages"
  ON friend_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- UPDATE: receiver can mark as read (only the read_at column)
CREATE POLICY "Receiver can mark as read"
  ON friend_messages FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Allow realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE friend_messages;
