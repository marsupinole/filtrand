var sys = require('sys');
var TwitterNode = require('./vendor/twitter-node').TwitterNode;
var Pusher = require('node-pusher');

var subjectToChannel = {};

// uncomment for local
//Pusher.prototype.domain = 'localhost';
//Pusher.prototype.port = 8081;

// staging
//Pusher.prototype.domain = 'api.staging.pusherapp.com';



// API

var streamer = exports;
var pusher = null;

// start tracking passed subject
streamer.track = function(channel) {
  var subject = streamer.channelToSubject(channel);
  var subjects = streamer.currentSubjects();

  if(!includes(subject, subjects))
    subjects.push(subject);

  streamer.twit = setup(subjects);
};

// stop tracking passed subject
streamer.untrack = function(channel) {
  var subject = streamer.channelToSubject(channel);
  var subjects = streamer.currentSubjects();

  if(includes(subject, subjects)) {
    subjects.splice(subjects.indexOf(subject), 1);
  }

  streamer.twit = setup(subjects);
};

// setup the streamer with a Pusher connection
streamer.appSetup = function(key, secret, appId) {
  pusher = new Pusher({
    appId: appId,
    key: key,
    secret: secret
  });
};

streamer.twitterSetup = function(username, password) {
  streamer.twitterUsername = username;
  streamer.twitterPassword = password;
};

streamer.currentSubjects = function() {
  var subjects = [];
  if(streamer.twit !== undefined)
    subjects = streamer.twit.trackKeywords;

  return subjects;
};

// supporting functions

streamer.subjectToChannel = function(subject) {
  return encodeURIComponent(subject).replace('-', '-0').replace('_', '-1')
    .replace('.', '-2').replace('!', '-3').replace('~', '-4').replace('*', '-5')
    .replace('(', '-6').replace(')', '-7')
};

streamer.channelToSubject = function(channel) {
  return decodeURI(channel.replace('-7', ')').replace('-6', '(').replace('-5', '*')
                   .replace('-4', '~').replace('-3', '!').replace('-2', '.')
                   .replace('-1', '_').replace('-0', '-'));
};

var includes = function(item, array) {
  var included = false;
  for(var i = 0; i < array.length; i++) {
    if(item == array[i]) {
      included = true;
      break;
    }
  }

  return included;
};

var tweetEmitter = function(tweet) {
  var subjects = streamer.currentSubjects();
  for(var i in subjects) {
    if(tweet.text.indexOf(subjects[i]) != -1) { // subject appears in tweet - emit it on channel
      emit(subjects[i], tweet);
    }
  }
};

var emit = function(subject, tweet) {
  var channel = streamer.getChannel(subject);
  pusher.trigger(channel, "tweet", tweet, null, function(err, req, res) {
    if(err) {
      console.log("Could not emit tweet event on Pusher API.");
    }
    else {
      console.log("Emitted tweet about " + subject + ": " + tweet.text)
    }
  });
};

var setup = function(subjects) {
  var twit = new TwitterNode({
    user: streamer.twitterUsername,
    password: streamer.twitterPassword,
    track: subjects
  });

  twit.addListener('error', function(error) {
    console.log(error.message);
  });
  twit
    .addListener('tweet', tweetEmitter)
    .addListener('end', function(resp) {
      sys.puts("wave goodbye... " + resp.statusCode);
    })
    .stream();

  return twit;
};