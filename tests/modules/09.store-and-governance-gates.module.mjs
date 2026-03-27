import path from "node:path";
import { pathToFileURL } from "node:url";

export const id = "09-store-and-llm-governance-gates";

export async function run({ assert, root }) {
  const { createStore } = await import(pathToFileURL(path.join(root, "src/kernel/store/createStore.js")));
  const { applyPatches, sanitizeForStore } = await import(pathToFileURL(path.join(root, "src/kernel/store/applyPatches.js")));
  const kernel = await import(pathToFileURL(path.join(root, "src/kernel/interface.js")));

  let blockedGuardOff = false;
  try {
    createStore({ reducer: (s) => s, guardDeterminism: false });
  } catch (error) {
    blockedGuardOff = String(error.message).includes("guardDeterminism");
  }
  assert(blockedGuardOff, "createStore muss guardDeterminism=false blockieren");

  const actionSchema = {
    TICK: { required: ["delta"] }
  };

  const mutationMatrix = {
    economy: ["world.resources", "world.balance", "world.label"]
  };

  const store = createStore({
    initialState: { world: { resources: 100, balance: 50 } },
    actionSchema,
    mutationMatrix,
    reducer: (state, action) => {
      return {
        world: {
          resources: state.world.resources,
          balance: state.world.balance + Number(action.payload.delta)
        }
      };
    },
    simStep: () => [{ op: "set", path: "world.resources", value: 101, domain: "economy" }]
  });

  const next = await store.dispatch({ type: "TICK", payload: { delta: 3 } }, { domain: "economy" });
  assert(next.world.balance === 53, "Reducer-Update fehlt");
  assert(next.world.resources === 101, "Patch-Update fehlt");
  assert(Object.isFrozen(store.getState()), "State muss gefroren sein");

  let blockedArrayPayload = false;
  try {
    await store.dispatch({ type: "TICK", payload: [] }, { domain: "economy" });
  } catch (error) {
    blockedArrayPayload = String(error.message).includes("payload muss Plain-Object sein");
  }
  assert(blockedArrayPayload, "Nicht-objektfoermiges Payload muss geblockt werden");

  let blockedRootReplace = false;
  try {
    applyPatches({ world: {} }, [{ op: "set", path: "", value: {}, domain: "economy" }], {
      domain: "economy",
      mutationMatrix
    });
  } catch (error) {
    blockedRootReplace = String(error.message).includes("Root-Container-Replacement");
  }
  assert(blockedRootReplace, "Root-Replacement muss geblockt werden");

  let blockedPathOutOfMatrix = false;
  try {
    applyPatches({ world: {} }, [{ op: "set", path: "world.hack", value: 1, domain: "economy" }], {
      domain: "economy",
      mutationMatrix
    });
  } catch (error) {
    blockedPathOutOfMatrix = String(error.message).includes("mutationMatrix");
  }
  assert(blockedPathOutOfMatrix, "Nicht erlaubter Patch-Pfad muss geblockt werden");

  let blockedProtoPath = false;
  try {
    applyPatches({ world: {} }, [{ op: "set", path: "__proto__.polluted", value: true, domain: "economy" }], {
      domain: "economy",
      mutationMatrix
    });
  } catch (error) {
    blockedProtoPath = String(error.message).includes("Ungueltiger Patch-Pfad");
  }
  assert(blockedProtoPath, "Prototype-Pfade muessen geblockt werden");

  let blockedMissingPatchDomain = false;
  try {
    applyPatches({ world: {} }, [{ op: "set", path: "world.resources", value: 1 }], {
      domain: "economy",
      mutationMatrix
    });
  } catch (error) {
    blockedMissingPatchDomain = String(error.message).includes("Patch-Domain fehlt");
  }
  assert(blockedMissingPatchDomain, "Fehlende Patch-Domain muss geblockt werden");

  const stringPatchResult = applyPatches({ world: { label: "" } }, [{ op: "set", path: "world.label", value: "ok", domain: "economy" }], {
    domain: "economy",
    mutationMatrix
  });
  assert(stringPatchResult.world.label === "ok", "String-Werte muessen sanitisiert durchgehen");

  const polluted = Object.create(null);
  polluted.__proto__ = { polluted: true };
  let blockedDangerousKey = false;
  try {
    sanitizeForStore(polluted);
  } catch (error) {
    blockedDangerousKey = String(error.message).includes("Ungueltiger Objekt-Schluessel");
  }
  assert(blockedDangerousKey, "Gefaehrliche Objekt-Schluessel muessen geblockt werden");

  let blockedProtoAction = false;
  try {
    await store.dispatch({ type: "__proto__", payload: {} }, { domain: "economy" });
  } catch (error) {
    blockedProtoAction = String(error.message).includes("Unbekannter Action-Type");
  }
  assert(blockedProtoAction, "Prototype-Action-Types muessen geblockt werden");

  const chainOk = await kernel.executeKernelCommand("governance.llm-chain", {
    domain: "economy",
    state: { world: { resources: 100, balance: 50 } },
    action: { type: "TICK", payload: { delta: 1 } },
    actionSchema,
    mutationMatrix,
    patches: [{ op: "set", path: "world.resources", value: 111, domain: "economy" }]
  });
  assert(chainOk.status === "ok", "LLM Governance Chain muss gueltigen Input akzeptieren");
  assert(Array.isArray(chainOk.chain) && chainOk.chain.length === 5, "Pflichtkette muss vollstaendig sein");

  let chainMissingPatchDomain = false;
  try {
    await kernel.executeKernelCommand("governance.llm-chain", {
      domain: "economy",
      state: { world: { resources: 100, balance: 50 } },
      action: { type: "TICK", payload: { delta: 1 } },
      actionSchema,
      mutationMatrix,
      patches: [{ op: "set", path: "world.resources", value: 111 }]
    });
  } catch (error) {
    chainMissingPatchDomain = String(error.message).includes("Patch-Domain fehlt");
  }
  assert(chainMissingPatchDomain, "LLM Governance Chain muss fehlende Patch-Domain blockieren");

  let chainBlocked = false;
  try {
    await kernel.executeKernelCommand("governance.llm-chain", {
      domain: "economy",
      state: { world: { resources: 100, balance: 50 } },
      action: { type: "UNKNOWN", payload: {} },
      actionSchema,
      mutationMatrix,
      patches: []
    });
  } catch (error) {
    chainBlocked = String(error.message).includes("Action type nicht erlaubt");
  }
  assert(chainBlocked, "LLM Governance Chain muss unbekannte Actions blockieren");

  let payloadGetterTriggered = false;
  const payloadWithGetter = Object.create(null);
  Object.defineProperty(payloadWithGetter, "delta", {
    enumerable: true,
    get() {
      payloadGetterTriggered = true;
      return 1;
    }
  });

  let blockedPayloadAccessor = false;
  try {
    await store.dispatch({ type: "TICK", payload: payloadWithGetter }, { domain: "economy" });
  } catch (error) {
    blockedPayloadAccessor = String(error.message).includes("Accessor-Properties");
  }
  assert(blockedPayloadAccessor, "Accessor-Properties im Payload muessen geblockt werden");
  assert(payloadGetterTriggered === false, "Payload-Getter darf nicht ausgefuehrt werden");

  let stateGetterTriggered = false;
  const stateWithGetter = Object.create(null);
  Object.defineProperty(stateWithGetter, "world", {
    enumerable: true,
    get() {
      stateGetterTriggered = true;
      return { resources: 100, balance: 50 };
    }
  });

  let blockedStateAccessor = false;
  try {
    await kernel.executeKernelCommand("governance.llm-chain", {
      domain: "economy",
      state: stateWithGetter,
      action: { type: "TICK", payload: { delta: 1 } },
      actionSchema,
      mutationMatrix,
      patches: [{ op: "set", path: "world.resources", value: 111, domain: "economy" }]
    });
  } catch (error) {
    blockedStateAccessor = String(error.message).includes("Accessor-Properties");
  }
  assert(blockedStateAccessor, "Accessor-Properties im State muessen geblockt werden");
  assert(stateGetterTriggered === false, "State-Getter darf nicht ausgefuehrt werden");
}
