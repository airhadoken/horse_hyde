var startwords;
var wordstats = {};
var words, lastword; // these are used in the for loop below
var LINEBREAK = "/\n";
var NOTERM = ['a', 'an', 'the', 'i', 'that', 'of', 'and', 'or', 
              'my', 'your', 'its', "it's", 'is', 'to'];

var fs = require('fs');
var restclient = require('node-restclient');
var Twit = require('twit');
var express = require('express');
var app = express();

var lines = [], files;
try {
  files = fs.readdirSync('data');
}
catch (err) {
  console.error("There was an error opening the data dir:");
  console.log(err);
}

files.forEach(function(file) {
    var newlines;
try {
  newlines = fs.readFileSync('data/' + file, 'utf-8');
  lines = lines.concat (newlines.split('\n').filter(function (line) {
    return line.length;
  }));
}
catch (err) {
  console.error("There was an error opening the file " + file + ":");
  console.log(err);
  process.exit(-1);
}
});
var titles = lines;


for (var i = 0; i < titles.length; i++) {
    var words = titles[i];
    if(!words)
      continue;
    // strip all punctuation from words except for apostrophes
    words = words.split(' ')
            .map(function(word) { return word.replace(/[^a-zA-Z']/g, "").toLowerCase().trim(); })
            .filter(function(word) { return word.trim().length; });
    if(words.length < 1)
      continue;
    for (var j = 0; j < words.length - 1; j++) {
      // This isn't perfect, since we stop at line breaks
      function pushnew(key, next) {
        if (wordstats.hasOwnProperty(key)) {
            wordstats[key].push(next);
        } else {
            wordstats[key] = [next];
        }
      }
      pushnew(words[j], words[j+1]);
      if(words[j+2]) {
        pushnew(words[j], words[j+1] + " " + words[j+2]);
      }

      if(lastword) {
        pushnew(lastword + " " + words[j], words[j+1]);
        if(words[j+2]) {
          pushnew(lastword + " " + words[j], words[j+1] + " " + words[j+2]);
        }
      }
      lastword = words[j];
    }
}
startwords = Object.keys(wordstats);

var choice = function (a) {
    var i = Math.floor(a.length * Math.random());
    return a[i];
};

var make_title = function (min_length) {
    // Underwold thing: put a repeating word at the end of every phrase
    // i.e. "hands girls boy / and steel boy / you had chemicals boy / I've grown so close to you boy"
    // Chance 25%.
    //  If two word phrase chosen from corpus, 50% chance of using just the second word 
    var stopword = Math.random() < 0.25 ? choice(startwords) : null;
    if(stopword && ~stopword.indexOf(" ") && Math.random() < 0.5) {
      stopword = stopword.substr(stopword.indexOf(" ") + 1);
    }
    var word = [choice(startwords)];
    var title = word.slice(0);
    var next_words;
    while (title.join(' ').length < min_length || ~NOTERM.indexOf(word[word.length-1].toLowerCase())) {
        next_words = null;
        // 30% chance of trying to find a key in the corpus from the last two words
        //  combined. (frequency weighted)
        // Avoid combining with a previous newline. Pick the word before the newline
        //  if you encounter it.
        if(title.length > 1 && Math.random() < 0.3) {
          next_words = wordstats[word.length > 1 
                                 ? word.join(" ") 
                                 : (title[title.length - 2]===LINEBREAK 
                                    ? title[title.length-3] 
                                    : title[title.length-2])
                                   + " " + word[0]
                                 ];
        }
        // 56-80% chance (depends on whether key is found above) of finding next
        // Markov step based on the last word alone. (frequency weighted)
        if(Math.random() < 0.8) {
          next_words = next_words || wordstats[word[1] || word[0]];        
        }
        // 14-20% chance of random word from corpus (evenly weighted)
        next_words = next_words || startwords;
        word = choice(next_words);
        word = word.split(" ");
        title = title.concat(word);
        // After 1-2 words have been added, 30% chance of splitting
        //  to new line.  Use stopword if it has been selected.
        if(!~NOTERM.indexOf(word[word.length-1].toLowerCase()) && Math.random() < 0.3) {
          stopword && title.push(stopword);
          title.push(LINEBREAK);
        }
    }
    // Don't end with a linebreak (slash-then-newline).
    if(title[title.length - 1] === LINEBREAK) {
      title.pop();
    }
    return title.join(' ');
};

/*
Uncomment these lines to just run once and spit out for development/debugging
console.log(make_title(120));
process.exit();
*/

// If deployed to Nodejitsu, it requires an application to respond to HTTP requests
// If you're running on Openshift or Heroku you may still need this to unidle your app
app.get('/', function(req, res){
    res.send("<h1>Recent retweets</h1>" + ((recent_retweets && recent_retweets.length) ? recent_retweets.join("<br>\n") : "No retweets"));
});
try {
  app.listen(
    process.env.OPENSHIFT_NODEJS_PORT || process.env.OPENSHIFT_INTERNAL_PORT || 8080,
    process.env.OPENSHIFT_NODEJS_IP ||
                         process.env.OPENSHIFT_INTERNAL_IP);
} catch(e) {
  console.error(e);
  //continue app. just forget about serving web
}
// insert your twitter app info here
var T = new Twit({
  consumer_key:     consumer_key, 
  consumer_secret:  consumer_secret,
  access_token:     access_token,
  access_token_secret: access_token_secret
});

function postNewTitle() {

    T.post('statuses/update', { status: make_title(120) }, function(err, reply) {
      if(err) console.error("error: " + err);
      console.log("reply: " + reply);
    });
}

var last_rt = 1;
function favRTs () {
  recent_retweets = recent_retweets.length > 100 ? recent_retweets.slice(0, 100) : recent_retweets;
  T.get('statuses/retweets_of_me', { since_id : last_rt }, function (e,r) {
    e && console.error(e);
    r.forEach(function(tweet,i) {
      setTimeout(function() {
    last_rt = Math.max(last_rt, tweet.id) + 1;
    T.get("statuses/retweets/"+tweet.id_str,{}, function(e, rt) {
        e && console.error("Error when getting retweets:", e);
        var sns = rt.map(function(t) { return "@" + t.user.screen_name }).join(", ");
        recent_retweets.unshift(tweet.text + " [Retweeted by " + (sns || "unknown") + "]");
    });
    if(!tweet.favorited) {
        T.post('favorites/create.json?id='+tweet.id_str,{},function(e){
      e && console.error("Error creating favorite", e);
        });
    }
      }, Math.floor(i / 15) * 15*60000); //Only allowed to get 15 retweet lists every 15 minutes
    });
    console.log('harvested some RTs'); 
  });
}

// every 2 minutes, make and tweet a metaphor
// wrapped in a try/catch in case Twitter is unresponsive, don't really care about error
// handling. it just won't tweet.
postNewTitle();
setInterval(function() {
  try {
    postNewTitle();
  }
 catch (e) {
    console.log(e);
  }
},120000);

// every 5 hours, check for people who have RTed a metaphor, and favorite that metaphor
setInterval(function() {
  try {
    favRTs();
  }
 catch (e) {
    console.log(e);
  }
},60000*60*5);

