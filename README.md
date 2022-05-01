# Pocket Service

A root service to manage data exchange between angular components in a simple and smarter way and to trigger actions from inside a component (or a group of components).

## Exchange data between components

TODO

### Registering a data namespace

TODO

### Listening for incoming data

The caller can set or not the receiver field. If the caller set the receiver field, it states its intention to send the data only those subscribers that have the same receiver field setted.
Otherwise, it will send the data to all subscribers.
From the subscriber point of view the receiver field can be set or not, too.
If the receiver field is set, the subscriber will receive all the data from all callers. Therefore, if the enforceSelf flag is set, it will only receive data from callers that send with the same receiver tag. In the other case, when the receiver field is not set, the subscriber will receive data from all callers that does not have a receiver tag.

## Trigger actions

TODO

### Registering an action namespace

TODO

### Listening for incoming actions

TODO
