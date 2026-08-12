import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

type BlueprintRealtimeIdentity = {
  companyId: string;
  projectId: string;
  versionId: string;
  userId: string;
};

type BlueprintRealtimeCallbacks = {
  onAnnotationChange: () => void;
  onPresenceChange: (activeUserIds: string[]) => void;
  onStatusChange?: (status: string) => void;
};

export function blueprintCollaborationChannelName(identity: Omit<BlueprintRealtimeIdentity, "userId">) {
  return `blueprint:${identity.companyId}:${identity.projectId}:${identity.versionId}`;
}

export function subscribeToBlueprintCollaboration(
  supabase: SupabaseClient,
  identity: BlueprintRealtimeIdentity,
  callbacks: BlueprintRealtimeCallbacks,
) {
  const channel = supabase.channel(blueprintCollaborationChannelName(identity), {
    config: { presence: { key: identity.userId } },
  });

  channel
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "blueprint_annotations",
        filter: `blueprint_version_id=eq.${identity.versionId}`,
      },
      callbacks.onAnnotationChange,
    )
    .on("presence", { event: "sync" }, () => {
      callbacks.onPresenceChange(activePresenceUserIds(channel));
    })
    .subscribe((status) => {
      callbacks.onStatusChange?.(status);
      if (status === "SUBSCRIBED") {
        void channel.track({
          user_id: identity.userId,
          company_id: identity.companyId,
          project_id: identity.projectId,
          blueprint_version_id: identity.versionId,
          online_at: new Date().toISOString(),
        });
      }
    });

  return () => {
    void channel.untrack();
    void supabase.removeChannel(channel);
  };
}

function activePresenceUserIds(channel: RealtimeChannel) {
  const userIds = new Set<string>();
  for (const presences of Object.values(channel.presenceState())) {
    for (const presence of presences) {
      const userId = typeof presence.user_id === "string" ? presence.user_id : null;
      if (userId) userIds.add(userId);
    }
  }
  return [...userIds];
}
