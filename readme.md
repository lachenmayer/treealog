# treealog

Treealog is an experiment in _non-linear_, _asynchronous_ video communication in a _peer-to-peer_ environment.

**You can try it out by visiting [dat://treealog.hashbase.io/](dat://treealog.hashbase.io/) with [Beaker Browser](https://beakerbrowser.com/).**

## ... _non-linear_ ...

Current tools for conversations display messages linearly, one after the other. This is a natural choice, because that's how conversations unfold in time: if we record a conversation, we (ideally) hear one person speak after another.

While contributions to a conversation usually do follow each other linearly in time, the content of the conversation often does not: we often don't respond to the latest thing that has been said. Instead, we might want to refer back to something that was said previously.

In treealog, a conversation does not follow the linear flow of _time_, but rather the branching, tree-structured flow of _replies_.

This structure is similar to threaded text conversations you might be familiar with from sites such as Reddit, Hacker News, or old school mailing lists.

## ... _asynchronous_ ...

Most video chat applications (such as FaceTime, Skype, etc.) focus on _synchronous_ conversations, much like a phone call: the call begins when two or more participants enter the conversation, ends when the participants leave the conversation, and participants communicate with each other in real time.

Most text-based communication is _asynchronous_: we start a conversation (eg. a chat group, or an email thread), and then add text messages at any point in time. Other participants see new messages whenever they next decide to look at them. This gives them the freedom to do other things in the meantime, or to communicate across timezones. (Some attempts at synchronous text messaging exist(ed), such as [Google Wave](https://www.youtube.com/watch?v=p6pgxLaDdQw), but I think that's a pretty obviously bad idea - imagine having a conversation with your friends by editing a Google Doc.)

## ... _video_ ...

We already have plenty of non-linear asynchronous text-based conversation tools - most of our online interaction currently happens through these tools. I often find it very hard to express myself properly in these environments, because I know that I have unlimited time to edit my contributions - as a result, I spend way too much time editing and rephrasing, turning what should take seconds into minutes or sometimes even hours of work.

I hope that by recording video, I can stop worrying about unimportant mistakes, and rather focus on getting the message across.

However, the process might just be as awkward as recording a voicemail, who knows...

## ... _peer-to-peer_ ...

Treealog can be accessed through [Beaker Browser](https://beakerbrowser.com/), which is an experimental browser that allows users to access sites using the [Dat](https://datproject.org/) protocol. A Dat archive (/ site) is identified by a long, random-looking address. By knowing a Dat archive's address (or _key_), it is possible to verify the authorship of the archive's contents, no matter where the content is received from. This is what makes Dat a _peer-to-peer_ protocol. Only a single person/device, the _owner_, can make changes to a Dat archive. (It is currently not easily possible to transfer ownership between devices.)

In Treealog, a conversation is represented by a Dat archive. A conversation contains links to further Dat archives. These archives contain every individual's contributions to the conversation, one archive for every contributor.

To become part of a conversation, the owner of the conversation archive needs to invite the new contributor.