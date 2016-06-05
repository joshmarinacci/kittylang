# parser

Parsers are a core part of most programs. Parsers are a core part of computer science.

what's a parser
why you need it   
examples that use a parser

There are lots of times you might need a parser. A new file format might come along that
you need to process and no one else has written a library for it yet. Or maybe
you find files in an old file format and the existing parsers aren't built for the
platform you need. I've seen this happen over and over.  Code will come and go but data is forever.

Maybe this processing task is more complex than a regex can handle. Or you want to create syntax highlighting for a new language, or you simply want to easily *do* something with the parsed data.
Whatever the reason, the need is the same: a parser.

The challenge is that parsers can be surprisingly difficult to write, and most of the existing
tools are old and assume a fair amount of arcane computer science knowledge.  Well, today
I want to show you a much better of way of writing parsers with a new open source tool
called Ohm.

In this blog series we will use Ohm to recognize numbers, parse file formats, build a calculator, and eventually create our own full programming language in under 200 lines of code.  I hope to show you that
powerful tools will let you do things that you might have thought impossible otherwise.


the point is parsers are a fundamental part of CS but they have been so hard to build that only advanced compiler developers make them
the tools are typically tricky, and don't mesh well with the language you use. very hard to debug.

imagine if your description of a file format was *also* the parser? why write it twice.


Ohm, a new kind of parsing system. While it resembles the BNF grammars you may have seen in text books
it's a lot more powerful and easier to use.  Ohm answers the question: what is your description
of a file format was *also* the parser? Why write it twice?!

With Ohm you write your format definition in a very flexible syntax in a .ohm file, then attach semantic meaning to it using your host language. For this blog we will use JavaScript as the host language.

Ohm is based on years of research into making parsers easier and more flexible. The VPRI's STEPS program created many custom languages for specific tasks (like a fully parallelizable graphics renderer in 400 lines of code!) using a Ohm's precursor OMeta.

Ohm has a bunch of interesting features and notations, but rather than explain them all I think we should just dive in and build a simple parser.

Let's parse some numbers. It seems like this would be easy. Just look for adjacent digits in a string of text; but let's try to handle *all* forms of numbers. Integers and floating point. Hex and octal. Scientific notation. A leading negative digit. Parsing for numbers is easy. *Doing it right is hard*

To build this code by hand would be difficult and buggy with lots of special cases which sometimes conflict with each other. A regular expression could probably do it, but would be ugly and unmaintainable. Let's do it with Ohm.

Every parser in Ohm involves three parts: the grammar, the semantics, and the tests.  I usually pick part of the problem and write tests for it, then build enough of the grammar and semantics to make the tests pass. Then I pick another part of the problem, add more tests, and update the grammar and semantics, while making sure all of the tests continue to pass.   Event with our more poweful tools writing parsers is still conceptually complicated. Tests is the only way to build them in a reasonable manner.   Now lets' dig it.


We'll start with just an integer number. An integer is composed of a sequences of digits next to
each other. Let's put this into a file called grammar1.ohm:

```
CoolNums {
   // just a basic integer
   Number = digit+
}
```

This creates a single rule called `Number` which matches one or more digits.
The `+` means one or more, just like in a regular expression. This rule will match if there is one digit or more than one digit. It won't match if there are zero digits or something something other than
a digit. A `digit` is defined as the characters for the numbers 0 to 9. `digit` is also a rule like Number is, but it's a built in rule so we don't have to define it ourselves. We could override if it we wanted to but that wouldn't make sense in this case. After all we don't plan to invent a new form of number (yet!)

Now we can read in this grammar and process it with the Ohm library.

Put this into test1.js

```
var ohm = require('ohm-js');
var fs = require('fs');
var assert = require('assert');
var grammar = ohm.grammar(fs.readFileSync('src/blog_numbers/syntax1.ohm').toString());
```

`ohm.grammar` will read in the file and parse it into a grammar object. Now we can add semantics.  Add this to your file:

```
var sem = grammar.semantics().addOperation('toJS', {
    Number: function(a) {
        return parseInt(this.interval.contents,10);
    }
});
```

This creates a set of *semantics* called `sem` with the operation `toJS`. The *semantics* are essentially a bunch of functions matching up to each rule in the grammar. Each function will be called with the corresponding rule in the grammar is called. The `Number` function above will be called when the `Number` rule in the grammar (grammar1.ohm) is parsed.  The grammar defines what chunks are *in* the language. The semantics define what to *do* with chunks once they've been parsed. Our function can do anything we want, like print debugging information, create objects, or recursively call `toJS` on any sub nodes. In this case we just want to convert the matched text into a real Javascript integer.

All semantic functions have an implicit `this` object with some useful properties. The `interval` property represents the part of the input text that matches this node. `this.interval.contents` is the matched input as a string. Calling the built in JavaScript funciton `parseInt` turns this string to a number. The `10` argument to `parseInt` tells JavaScript that we are giving it a number in base ten. If we leave it out then JS will assume it's base 10 anyway, but I've included it because later on we will support base 16 (hex) numbers, so it's good to be explicit.

Now that we have some semantics, let's actually parse something to see if our parser works. How do we know our parser works? By testing it. Lots and lots of testing. Every possible edge case needs a test. With the standard `assert` API, here is a test function which matches some input then applies our semantics to it to turn it into a number, then compares the number with the expected input.

```
    function test(input, answer) {
     var match = grammar.match(input);
     if(match.failed()) return console.log("input failed to match " + input + match.message);

     var result = sem(match).toJS();
     assert.deepEqual(result,answer);
     console.log('success = ', result, answer);
    }
```

That's it. Now we can write a bunch of tests for different numbers. If the match fails then our script
will throw an exception. If not it will print success. Let's try it out.  Add this to the script

```
    test("123",123);
    test("999",999);
    test("abc",999);
```

Then run the script with `node test1.js`

Your output should look like this:


```
success =  123 123
success =  999 999
input failed to match abcLine 1, col 1:
> 1 | abc
      ^
Expected a digit
```

Cool. The first two succeed and the third one fails. Even better, Ohm automatically gave us a nice error message pointing to the match failure.

Our parser works, but it doesn't do anything very interesting. Let's extend it to parse
both integers and floating point numbers.  Change the grammar1.ohm file to look like this:

```
CoolNums {
  // just a basic integer
  Number = float | int
  int    = digit+
  float  = digit+ "." digit+
}
```

This changes Number to point to either a float or an int. The `|` means or. We read
this as "Number is composed of a float or an int".  Then int is defined as digit+ and float
is defined as digit+ followed by a period followed by another digit+.  This means
there must be at least one digit before the period and at least one after. If there
is not a period then it won't be a float at all, so 'int' will match instead.

Now let's go look at our semantic actions again.  Since we now have new rules
we need new action functions: one for int and one for float.

```
var sem = grammar.semantics().addOperation('toJS', {
    Number: function(a) {
        return a.toJS();
    },
    int: function(a) {
        console.log("doing int", this.interval.contents);
        return parseInt(this.interval.contents,10);
    },
    float: function(a,b,c) {
        console.log("doing float", this.interval.contents);
        return parseFloat(this.interval.contents);
    }
});
```

There's two things to note here. First, int and float and Number all have matching grammar rules and functions. However, the action for Number no longer does anything interesting. It receives the child node 'a' and returns the result of toJS on the child. In other words the Number rule simply returns whatever its child rule matched.  Since this is the default behavior of any rule in Ohm we can just leave the Number action out. Ohm will do it for us.

Second, int has one argument 'a' while float has three: 'a', 'b', and 'c'.  This is because of the rule's arity. [Arity](link) means how many arguments a rule has. If we look back at the grammar, the rule for 'float' is

```
  float  = digit+ "." digit+
```

The float is define by three parts: the first `digit+`, the `"."` and the second `digit+`. All three of those parts will be passed as parameters to the action function for float. Thus float must have three arguments or else the Ohm library will give us an error.  In this case we don't care about the arguments because we will just grab the input string directly, but we still need the arguments listed to avoid compiler errors. Later on we will actually use some of these parameters.

Now we can add a few more tests for our new floating point number support.

```
test("123",123);
test("999",999);
//test("abc",999);
test('123.456',123.456);
test('0.123',0.123);
test('.123',0.123);
```

Note that the last test will fail. A floating point number must begin with a digit, even if it's just zero. .123 is not valid, and in fact the JavaScript language has the same rule.

So now we have integers and floats but there's a few other number syntaxes
that might be good to support: hexadecimal and scientific notation.  Hex numbers are
integers in base sixteen. The digits can be from 0 to 9 and A to F. Hex is often
used in computer science when working with binary data.


In most C derived programming languages (including JavaScript) hex numbers are preceded by `0x` to indicate to the compiler that what follows is a hexadecimal number. To support hex numbers in our
parser we just need to add another rule.


```
  Number = hex | float | int
  int    = digit+
  float  = digit+ "." digit+
  hex    = "0x" hexDigit+
  hexDigit := "0".."9" | "a".."f" | "A".."F"
```

I've actually added two rules. `hex` says that a hex number is the string `0x` followed
by one or more `hexDigit`s. A `hexDigit` is any letter from 0 to 9, or a to f,
or A to F (covering both upper and lower case).  I also modified Number to recognize it as another possible option. Now we just need another action rule for hex.

```
    hex: function(a,b) {
        return parseInt(this.interval.contents,16);
    }
```

Notice that in this case we are passing 16 has the radix to `parseInt` because we want JavaScript to know that this is a hexadecimal number.

I skipped over something important to notice. The rule for hexDigit looks like this.

```
  hexDigit := "0".."9" | "a".."f" | "A".."F"
```

Notice that I used `:=` instead of `=`.  In Ohm, the `:=` is used when you are overriding a rule. It turns out Ohm already has a default rule for 'hexDigit', just as it does for `digit`, `space` and a bunch of others.  If I had used just `=` then Ohm would have reported an error. This way I can't override a rule unintentionally.  Since our new hexDigit rule is actually the same as Ohm's built in hexDigit rule we can just comment it out. I left it in just so we can see what's really going on.

Now we can add some more tests and see that our hex digits really work:

```
test('0x456',0x456);
test('0xFF',255);
```

Finally let's support scientific notation. This is for very large or small numbers like 1.8 x 10^3  In most programming languages this would be written as 1.8e3 for 18000 or 1.8e-3 for .0018.   Let's add another couple of rules to support this exponent notation.

```
    float  = digit+ "." digit+ exp?
    exp    = "e" "-"? digit+
```

This adds a the `exp` rule to the end of the float rule with a question mark. The `?` means zero or one, so `exp` is optional but there can't be more than one. Adding the `exp` rule also changes the arity of the float rule, so we need to add another argument to the float action, even if we don't use it.

```
    float: function(a,b,c,d) {
        console.log("doing float", this.interval.contents);
        return parseFloat(this.interval.contents);
    },
```

And now our new tests can pass:

```
test('4.8e10',4.8e10);
test('4.8e-10',4.8e-10);
```


Ohm is a great tool for building parsers because it's easy to get started and you can incrementally add to it. It also has other great features that I didn't cover today, like a debugging visualizer and subclassing.  

So far we have used Ohm to translate character strings into JavaScript numbers, and often Ohm is used for this very purpose: converting one representation to another. However, Ohm can be used for a lot more. By putting in a different set of semantic actions you can use Ohm to actually process and calculate things. This is one of Ohm's magic features. A single grammar can be used with many different semantics.

In the next article of this series I'll show you how to not just parse numbers but actually evaluate math expressions like `(4.8+5 * (238-68)/2)`, like a real calculator.

Bonus challenge: Can you extend the grammar with support for octal numbers? These are numbers in base 8 and can be represented with only the digits 0 to 7, preceded by a zero and the letter `o`.  See if you are right with these test cases. Next time I'll show you the answer.

```
test('0o77',7*8+7);
test('0o23',0o23);
```
