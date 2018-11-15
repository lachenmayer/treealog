# Jobs

The purpose of this document is to list all of the high-level requirements that
this project supports right now, or might support in future.

These requirements are written in [Job Story](https://jtbd.info/) format, ie:

- _When_ ...
- _I want to_ ...
- _So that_ ...

## Notation

- ✅: works
- 🆗: kind of works
- ⚠️: does not work currently, but want to make it work
- 🚫: not going to do this

## Jobs

| When | I want to | So that | Status | Comment |
|------|-----------|---------|--------|---------|
| When I land on treealog | I want to be able to create a conversation | So that I can have a conversation | ✅ | - |
| When I land on treealog | I want to see all the conversations I'm part of | So that I can check out existing conversations | 🆗 | uses Beaker archive picker, so don't have much control |
| When I'm looking for content to check out | I want to see which of my conversations have been updated since I last checked | So that I can see new stuff | ⚠️ | uses Beaker archive picker, so we don't really have control over it
| When I'm in a conversation | I want to be able to add a response to any contribution | So that I can respond to that particular contribution |  ✅  | - |
| When I'm looking at a conversation that I'm not part of | I want to be able to add a response to any contribution | So that I can respond to that particular contribution | ✅ | response will not be seen by anyone else at this point |
| When I've created a response in a conversation that I'm not part of | I want to be notified that the conversation owner needs to add me to the conversation for them to see it | So that I don't assume that my response will be seen by the people in the conversation | ✅ | - |
| When there aren't enough people (ie. none...) in my conversation | I want to add contributors to the conversation | So that I can talk with others | 🆗 | you have to send people the conversation link & wait for them to send you the invite link back. |
| When I am in a conversation | I want to see who is participating in that conversation | So I know who's in it | ⚠️ | - |
| When I am in a conversation | I want to see the seeding status for all the contributors | So I can figure out if some content is missing & tell the contributor that they need to seed their stuff | ⚠️ | - |
| When I am using treealog | I want it to look good | So that I can happily show it off to my design-conscious friends | ⚠️ | - |
| When I own a conversation | I want to change the conversation name | So that I & others can recognize it | ⚠️ | - |
| When I am in a conversation | I want to have a name & profile picture | So that others know who I am | ⚠️ | - |
