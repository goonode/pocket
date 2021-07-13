// actions for IN_POCKET_ACTIONS sub tag
export type IN_POCKET_ACTION_TYPE = 'add' | 'new' | 'remove' | 'delete' |
  'edit' | 'update' | 'cancel' | 'reload' | 'none';

export const IN_POCKET_ACTION = 'IN_POCKET_ACTION';

export interface InPocketActionData {
  do: IN_POCKET_ACTION_TYPE;
  args?: Record<string, any>;
  executed?: boolean;
  targetModule?: string;
}

export interface InPocketAction {
  [ IN_POCKET_ACTION ]: InPocketActionData[];
}
