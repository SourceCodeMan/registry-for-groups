"use client";

import { createContext, useContext } from "react";

/**
 * Whether photo uploads are available — decided ONCE on the server (is a Blob
 * store configured?) and handed to the client, so the upload button and the
 * upload endpoint can never disagree. No separate public flag to keep in sync.
 */
const UploadsContext = createContext(false);

export function UploadsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <UploadsContext.Provider value={enabled}>
      {children}
    </UploadsContext.Provider>
  );
}

export function useUploadsEnabled() {
  return useContext(UploadsContext);
}
