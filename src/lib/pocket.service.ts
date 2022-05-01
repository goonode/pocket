import { Injectable, Optional, SkipSelf } from '@angular/core';

import * as R from 'rambda';

import { BehaviorSubject, Observable, Observer, pipe, Subject, Subscription } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { InPocketActionData, IN_POCKET_ACTION } from './pocket.action';
import { stackTrace } from './error.function';

export interface PocketFilterOption {
  enforceSelf?: boolean;
}
export interface PocketPipeParams {
  caller?: string;
  receiver?: string;
  filter?: any;
  enforceSelf?: boolean;
}
export interface PocketNextParams {
  caller?: string;
  receiver?: string;
  filter?: any;
  emitEvent?: boolean;
}
export interface PocketDebug {
  debug?: boolean;
  subscriberID?: string;
}

export class ObservableWrapper<T> extends Observable<T> {
  constructor( private tag: string = null ) { super(); }

  subscribe( observer?: Partial<Observer<T>> ): Subscription;
  subscribe( next: ( value: T ) => void ): Subscription;
  subscribe( next?: ( value: T ) => void, error?: ( error: any ) => void, complete?: () => void ): Subscription;
  subscribe( next?: any, error?: any, complete?: any ): Subscription {
    const s = super.subscribe( next, error, complete );
    ( s as unknown as any ).subscriberID = this.tag;
    return s;
  }
}

export class BehaviorSubjectWrapper<T> extends BehaviorSubject<T> {
  constructor( _value: T ) { super( _value ); }

  asObservable( tag: string = null ): Observable<T> {
    const obs: any = new ObservableWrapper<T>( tag );
    obs.source = this;
    return obs;
  }
}

export interface PocketData {
  new: Record<string, any>,
  old?: Record<string, any>,
  // used by pocket filters
  caller?: string,
  receiver?: string,
  filter?: any;
  // reserved
  emitEvent?: boolean;
}
export interface PocketActionData {
  action: InPocketActionData[];
  // used by action filters
  caller?: string,
  receiver?: string,
  filter?: any;
  // reserved
  emitEvent?: boolean;
}
export interface PocketSubject {
  [ k: string ]: BehaviorSubjectWrapper<PocketData>;
}
export interface PocketActionSubject {
  [ k: string ]: BehaviorSubjectWrapper<PocketActionData>;
}

export const POCKET_GLOBAL = 'global';

export const pocketGenericFilter = ( f: any, o: PocketFilterOption = { enforceSelf: false } ) => pipe(
  filter( ( v: PocketData | PocketActionData ) => {
    if ( v.filter ) {
      if ( Array.isArray( f ) ) {
        if ( Array.isArray( v.filter ) ) {
          if ( f.length === v.filter.length ) {
            const r = v.filter.map( e => f.includes( e ) );
            if ( r.length === v.filter.length ) { return true; }
          } else { return false; }
        } else {
          throw new Error( `pocketGenericFilter: both parameters should be arrays` );
        }
      }

      if ( typeof f === 'object' ) {
        if ( typeof v.filter === 'object' ) {
          for ( const k of Object.keys( f ) ) {
            if ( f[ k ] !== v.filter[ k ] ) { return false; }
          }
          return true;
        } else {
          throw new Error( `pocketGenericFilter: both parameters should be objects` );
        }
      }

      return v.filter === f;
    }

    return true;
  } ),
);

export const pocketCallerFilter = ( f: string, o: PocketFilterOption = { enforceSelf: false } ) => pipe(
  filter( ( v: PocketData | PocketActionData ) => {
    if ( v ) {
      if ( v.caller ) {
        return v.caller === f;
      }
    }

    return true;
  } ),
);

// filter the events using the receiver field of the pocket data. If the pocket
// data contains the receiver field this should match the filter field to pass.
// If the pocket data does not contains the receiver field the message will pass
// the filter unless the enforceSelf flag is set to true.
// That means if the caller sets the 'receiver' field in pocket data options,
// only the subscriber that have the receiver field setted with that filter will
// receive the event, while if the caller does not set the receiver field all
// subscribers will receive the event, but those subscribers that have
// enforceSelf to true.
export const pocketReceiverFilter = ( f: string, o: PocketFilterOption = null ) => {
  const { enforceSelf } = { enforceSelf: false, ...o }
  return pipe(
    filter( ( v: PocketData | PocketActionData ) => {
      if ( v ) {
        if ( v.receiver ) {
          return v.receiver === f;
        }
      }

      return !enforceSelf;
    } ),
  );
}

export const eventFilter = () => pipe(
  filter( ( v: PocketData | PocketActionData ) => {
    if ( v ) {
      try {
        if ( v.hasOwnProperty( 'emitEvent' ) ) { return v.emitEvent === true; }
        else {
          // console.warn( `pocket::filter: passed data is not a kind of PocketData or PocketActionData` );
          return true;
        }
      } catch ( e ) {
        console.warn( `pocket::filter: passed data is not a kind of PocketData or PocketActionData` );
        return true;
      }
    }

    console.warn( `pocket::filter: passed data is null` );
    return true;
  } ),
);

@Injectable( { providedIn: 'root' } )
export class PocketService {
  private module = 'PocketService';
  private pockets: PocketSubject = {};
  private actions: PocketActionSubject = {};
  private tags: string[] = [];

  constructor( @Optional() @SkipSelf() parent?: PocketService ) {
    if ( parent ) {
      throw Error(
        `[PocketService]: trying to create multiple instances,
                but this service should be a singleton.`
      );
    }

    this.pockets[ POCKET_GLOBAL ] = new BehaviorSubjectWrapper<PocketData>( { new: null } );
  }

  register( k: string, inaction = false ) {
    if ( inaction ) {
      if ( this.actions[ k ] != null ) { return; }
      this.actions[ k ] = new BehaviorSubjectWrapper<PocketActionData>( { action: [] } );
    } else {
      if ( this.pockets[ k ] != null ) { return; }
      this.pockets[ k ] = new BehaviorSubjectWrapper<PocketData>( { new: {} } );
    }
  }

  // create a pocket subject and return an observable
  observe( k: string, p: PocketPipeParams = null, opts: PocketDebug = null ): Observable<PocketData> {
    const { caller, receiver, filter, enforceSelf, } =
      { caller: null, receiver: null, filter: null, enforceSelf: false, ...p };
    if ( this.pockets[ k ] == null ) { this.register( k ); }
    return this.pockets[ k ].asObservable( opts ? opts.subscriberID : null ).pipe(
      eventFilter(),
      pocketReceiverFilter( receiver, { enforceSelf } )
    ) as Observable<PocketData>;
  }

  // create an action subject and return an observable
  action( k: string, p: PocketPipeParams = null, opts: PocketDebug = null ): Observable<PocketActionData> {
    const { caller, receiver, filter, enforceSelf, } =
      { caller: null, receiver: null, filter: null, enforceSelf: false, ...p };
    if ( this.actions[ k ] == null ) { this.register( k, true ); }
    return this.actions[ k ].asObservable( opts ? opts.subscriberID : null ).pipe(
      eventFilter(),
      pocketReceiverFilter( receiver, { enforceSelf } )
    ) as Observable<PocketActionData>;
  }

  // create a pocket subject and return an observable with a takeUntil operator piped in
  observeUntil( k: string, o: Observable<any> | Subject<any>, p: PocketPipeParams = null, opts: PocketDebug = null ) {
    const { caller, receiver, filter, enforceSelf, } =
      { caller: null, receiver: null, filter: null, enforceSelf: false, ...p };
    if ( this.pockets[ k ] == null ) { this.register( k ); }
    return this.pockets[ k ].asObservable( opts ? opts.subscriberID : null ).pipe(
      takeUntil( o ),
      eventFilter(),
      pocketReceiverFilter( receiver, { enforceSelf } ),
    ) as Observable<PocketData>;
  }

  // create an action subject and return an observable with a takeUntil operator piped in
  actionUntil( k: string, o: Observable<any> | Subject<any>, p: PocketPipeParams = null, opts: PocketDebug = null ): Observable<PocketActionData> {
    const { caller, receiver, filter, enforceSelf, } =
      { caller: null, receiver: null, filter: null, enforceSelf: false, ...p };
    if ( this.actions[ k ] == null ) { this.register( k, true ); }
    return this.actions[ k ].asObservable( opts ? opts.subscriberID : null ).pipe(
      takeUntil( o ),
      eventFilter(),
      pocketReceiverFilter( receiver, { enforceSelf } ),
    ) as Observable<PocketActionData>;
  }

  // operate on pockets subjects
  next( k: string, v: Record<any, any>, o: PocketNextParams = null, debug = false ) {
    const { caller, receiver, filter, emitEvent, } =
      { caller: null, receiver: null, filter: null, emitEvent: true, ...o };

    if ( debug ) { console.log( `k:${k},v:${JSON.stringify( v )},o:${JSON.stringify( o )}` ); }

    if ( !v ) { return null; }
    if ( this.pockets[ k ] == null ) { throw new Error( `${this.module}: next called before registration on ${k} : ${stackTrace()}` ); }
    const value: PocketData = this.pockets[ k ].value || { new: null };
    value.new = value.new ? value.new : {};
    value.old = value.old ? value.old : {};

    if ( debug ) { console.log( `before:: old:${JSON.stringify( value.old )},new:${JSON.stringify( value.new )}` ); };

    for ( const i of Object.keys( v ) ) {
      value.old[ i ] = value.new[ i ];
      value.new[ i ] = ( typeof v[ i ] === 'object' ) ? R.clone( v[ i ] ) : v[ i ];
    }

    if ( debug ) { console.log( `after:: old:${JSON.stringify( value.old )},new:${JSON.stringify( value.new )}` ); };

    value.caller = caller;
    value.receiver = receiver;
    value.filter = filter;
    value.emitEvent = emitEvent;

    if ( debug ) { console.log( `value:: ${JSON.stringify( value )}` ); };

    this.pockets[ k ].next( value as PocketData );
  }

  // operate on action subjects
  emit( k: string, v: InPocketActionData[], o: PocketNextParams = null ) {
    const { caller, receiver, filter, emitEvent, } =
      { caller: null, receiver: null, filter: null, emitEvent: true, ...o };
    if ( !v ) { return null; }
    if ( !Array.isArray( v ) ) { v = [ v ]; }
    if ( this.actions[ k ] == null ) { throw new Error( `${this.module}: emit called before registration on ${k} : ${stackTrace()}` ); }
    const a = {
      action: v,
      caller,
      receiver,
      filter,
      emitEvent,
    } as PocketActionData;
    this.actions[ k ].next( a );
  }

  complete( k: string, inaction = false ) {
    if ( inaction ) {
      if ( this.actions[ k ] == null ) { return null; }
      this.actions[ k ].complete();
      delete this.actions[ k ];
    } else {
      if ( this.pockets[ k ] == null ) { return null; }
      this.pockets[ k ].complete();
      delete this.pockets[ k ];
    }
  }

  // pockets only
  value<T>( registeredKey: string, sub = null ) {
    if ( this.pockets[ registeredKey ] == null ) { return null; }
    if ( sub ) {
      if ( this.pockets[ registeredKey ].value.new && this.pockets[ registeredKey ].value.new[ sub ] == null ) { return null; }
      else { return this.pockets[ registeredKey ].value.new[ sub ] as T; }
    }
    return this.pockets[ registeredKey ].value.new as T;
  }

  // pockets only
  oldValue<T>( registeredKey: string, sub = null ) {
    if ( this.pockets[ registeredKey ] == null ) { return null; }
    if ( sub ) {
      if ( this.pockets[ registeredKey ].value.old && this.pockets[ registeredKey ].value.old[ sub ] == null ) { return null; }
      else { return this.pockets[ registeredKey ].value.old[ sub ] as T; }
    }
    return this.pockets[ registeredKey ].value.old as T;
  }

  // pockets only
  val<T>( v: any, dataKey: string, subDataKey = null ) {
    if ( v == null || v.new == null || v.new[ dataKey ] == null ) { return null; }
    if ( subDataKey ) {
      if ( v.new[ dataKey ] && v.new[ dataKey ][ subDataKey ] == null ) { return null; }
      else { return v.new[ dataKey ][ subDataKey ] as T; }
    }
    return v.new[ dataKey ] as T;
  }

  // pockets only
  old<T>( v: any, dataKey: string, subDataKey = null ) {
    if ( v == null || v.old == null || v.old[ dataKey ] == null ) { return null; }
    if ( subDataKey ) {
      if ( v.old[ dataKey ] && v.old[ dataKey ][ subDataKey ] == null ) { return null; }
      else { return v.old[ dataKey ][ subDataKey ] as T; }
    }

    return v.old[ dataKey ] as T;
  }

  // (pockets only) returns true if the [k][sub | optional] is not null
  check( k: string, sub = null ): boolean {
    if ( this.pockets[ k ] == null || this.pockets[ k ].value == null || this.pockets[ k ].value.new == null ) { return false; }
    if ( this.pockets[ k ].value.new[ sub ] == null ) { return false; }
    return true;
  }

  // (pockets only) clear the value associated to a key and sub fields, if specified
  // TODO: check the else branch against pocket data instead of emit null
  clear( k: string, sub = null, emitEvent = true ) {
    if ( this.pockets[ k ] == null ) { return null; }
    if ( sub ) {
      if ( this.pockets[ k ].value ) {
        if ( this.pockets[ k ].value.old ) { this.pockets[ k ].value.old = {}; }
        this.pockets[ k ].value.old[ sub ] = this.pockets[ k ].value.new[ sub ];
        delete this.pockets[ k ].value.new[ sub ];
        this.pockets[ k ].value.emitEvent = emitEvent;
      }
      this.pockets[ k ].next( this.pockets[ k ].value );
    } else {
      if ( this.pockets[ k ].value ) { this.pockets[ k ].value.emitEvent = emitEvent; }
      this.pockets[ k ].next( this.pockets[ k ].value );
    }
  }

  // @deprecated clearAction clear the action associated to a given module
  clearAction( k: string, emitEvent = false ) {
    if ( this.actions[ k ] == null ) { return null; }
    this.actions[ k ].next( { action: [], emitEvent } );
    this.actions[ k ].next( this.actions[ k ].value );
  }

  // @deprecated return the action and remove if exists for the given module, or null
  pullAction( k: string, m: string ): InPocketActionData {
    if ( this.pockets[ k ] == null || this.pockets[ k ].value == null ) { return null; }
    if ( this.pockets[ k ].value[ IN_POCKET_ACTION ] == null ) { return null; }
    const i = ( this.pockets[ k ]
      .value[ IN_POCKET_ACTION ] as InPocketActionData[] ).findIndex( a => a.targetModule === m );
    if ( i === -1 ) { return null; }
    const a = ( this.pockets[ k ].value[ IN_POCKET_ACTION ] as InPocketActionData[] ).splice( i, 1 );

    return a[ 0 ];
  }

  // extract the actions from the PocketActionData object ore returns an empty
  // array if it cannot extract.
  getActions( p: PocketActionData ): InPocketActionData[] {
    if ( !p || !p.action || !Array.isArray( p.action ) ) { return []; }
    return p.action;
  }

  // PocketData only
  isNewEmpty( p: PocketData ) {
    return !p || R.isNil( p.new ) || R.isEmpty( p.new );
  }

  // PocketData only
  isOldEmpty( p: PocketData ) {
    return !p || R.isNil( p.old ) || R.isEmpty( p.old );
  }

  // (PocketData only) Check if new and old in pocket data for the 'k' key has
  // the same value for the 'f' field.
  isKeyChanged( p: PocketData, k: string, f: string, relaxed = false ) {
    if ( !p || !k || !f ) { throw new Error( `${this.module}: PocketData, key and field parameters are madatory to compare` ); }
    if ( !p.new ) { return true; }
    if ( !p.old ) { return true; }
    if ( !p.new[ k ] ) { return true; }
    if ( !p.old[ k ] ) { return true; }
    return relaxed ? p.old[ k ][ f ] != p.new[ k ][ f ] : p.old[ k ][ f ] !== p.new[ k ][ f ];
  }

  debug( k: string, inaction = false ) {
    if ( inaction ) {
      if ( this.actions[ k ] == null ) { return null; }
      return this.actions[ k ].value;
    } else {
      if ( this.pockets[ k ] == null ) { return null; }
      return this.pockets[ k ].value;
    }
  }

  whatIsInPocket() {
    let out = 'pockets:\n';
    for ( const k of Object.keys( this.pockets ) ) {
      out = `${k}: ${JSON.stringify( this.pockets[ k ].value )}\n`;
    }

    return out;
  }

  whatIsInAction() {
    let out = 'actions:\n';
    for ( const k of Object.keys( this.actions ) ) {
      out = `${k}: ${JSON.stringify( this.actions[ k ].value )}\n`;
    }

    return out;
  }

  private tagObserver( s: BehaviorSubject<any>, o: Observable<PocketData | PocketActionData>, tag: string ) {
  }
}
