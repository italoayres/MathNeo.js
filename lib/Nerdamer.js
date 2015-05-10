var nerdamer = (function() {
    
    var version = '0.5.4',
        _ = new Parser(), //nerdamer's parser
    
        Groups = {},
        
        //this is the class which holds the utilities which are exported to the core
        //All utility functions which will be available to the core should be added to this object
        Utils = {},
        
        //Settings
        Settings = {
            suppress_errors: false,
            //the global used to invoke the libary to parse to a number
            PARSE2NUMBER: false,
            //this flag forces the a copy to be returned when add, subtract, etc... is called
            SAFE: false
        },

        //Add the groups. These have been reorganized in v0.5.1 to make CP the highest group
        //The groups that help with organizing during parsing. Note that for FN is still a function even 
        //when raised to a symbol which typically results in an EX
        N   = Groups.N  = 1, // A number
        S   = Groups.S  = 2, // A single variable e.g. x. I refrain from using monomial to avoid confusion
        EX  = Groups.EX = 3, // A symbol/expression with an exponent that is not a number e.g. x^y
        FN  = Groups.FN = 4, // A function
        PL  = Groups.PL = 5, // A symbol/expression having same name with different powers e.g. 1/x + x^2
        CB  = Groups.CB = 6, // A symbol/expression composed of one or more variables through multiplication e.g. x*y
        CP  = Groups.CP = 7, // A symbol/expression composed of one variable and any other symbol or number x+1 or x+y
        
        
        //GLOBALS
        PARENTHESIS = 'parens',

        //the function which represent vector
        VECTOR = 'vector',

        SQRT = 'sqrt',
        
        ABS = 'abs',

        //the storage container "memory" for parsed expressions
        EQNS = [],
        
        //variables
        VARS = {},
        
        //the container used to store all the reserved functions
        RESERVED = [],
        
        isReserved = Utils.isReserved = function(value) { 
            return RESERVED.indexOf(value) !== -1;
        },
        
        error = function(msg) {
            if(!Settings.suppress_errors) throw new Error(msg);
        },
        
        // Enforces rule: must start with a letter and can have any number of underscores or numbers after.
        validateName = Utils.validateName = function(name, typ) { 
            typ = typ || 'variable';
            var regex = /^[a-z_][a-z\d\_]*$/gi;
            if(!(regex.test( name)) ) {
                error(name+' is not a valid '+typ+' name');
            }
        },
        
        isFraction = Utils.isFraction = function(num) {
            if(isSymbol(num)) return isFraction(num.multiplier);
            return (num % 1 !== 0);
        },

        isSymbol = Utils.isSymbol = function(obj) {
            return (obj instanceof Symbol);
        },
        
        isVector = Utils.isVector = function(obj) {
            return (obj instanceof Vector);
        },
        
        isNumericSymbol = Utils.isNumericSymbol = function(symbol) {
            return symbol.group === N;
        },

        isArray = Utils.isArray = function(arr) {
            return arr instanceof Array;
        },

        isInt = Utils.isInt = function(num) {
            return num % 1 === 0;
        },

        isNegative = Utils.isNegative = function(obj) {
            if( isSymbol(obj) ) {
                obj = obj.multiplier;
            }
            return obj < 0;
        },
        
        isComposite = Utils.isComposite = function(symbol) {
            return (symbol.group === PL || symbol.group === CP);
        },
        
        inBrackets = Utils.inBrackets = function(str) {
            return '('+str+')';
        },
        
        customType = Utils.customType = function(obj) {
            return obj !== undefined && obj.custom;
        },
        
        sameSign = Utils.sameSign = function(a, b) {
            return (a < 0) === (b < 0);
        },
        
        format = Utils.format = function() {
            var args = [].slice.call(arguments),
                str = args.shift();
                return str.replace(/{(\d+)}/g, function(match, index) {
                    var arg = args[index];
                    return typeof arg === 'function' ? arg() : arg;
                });
        },
        
        keys = Utils.keys = function( obj ) {
            var k = [];
            for( var key in obj ) { k.push( key ); }
            return k;
        },
        
        // Items do not have a fixed order in objects so only use if you need any first random item in the object
        firstObject = Utils.firstObject = function(obj) {
            for( var x in obj ) break;
            return obj[x];
        },
        
        arrayMax = Utils.arrayMax = function(arr) {
            return Math.max.apply(undefined, arr);
        },

        arrayMin = Utils.arrayMin = function(arr) {
            return Math.min.apply(undefined, arr);
        },
        
        round = Utils.round = function( x, s ) { 
            s = s || 14;
            return Math.round( x*Math.pow( 10,s ) )/Math.pow( 10,s );
        },
        
        // Inserts an object into an array or recursively adds items if an array is given
        insertArray = Utils.insertArray = function( arr, item, index, unpackArray ) {
            unpackArray = unpackArray === false ? unpackArray : true;

            if( isArray( item ) && unpackArray ) {
                for( var i=0; i<=item.length+1; i++ ){
                    insertArray( arr, item.pop(), index );
                }
            }
            else if( typeof index === 'undefined ') {
                arr.push( item );
            }
            else{
                arr.splice( index, 0, item );
            }
        },
        
        variables = Utils.variables = function( obj, vars ) { 
            vars = vars || {
                c: [],
                add: function(value) {
                    if(this.c.indexOf(value) === -1 && isNaN(value)) this.c.push(value);
                }
            };

            if(isSymbol(obj)) { 
                var group = obj.group,
                    prevgroup = obj.previousGroup;
                if(group === CP || group === CB || prevgroup === CP || prevgroup === CB) {
                    for(var x in obj.symbols) variables(obj.symbols[x], vars);
                }
                else if(group === S || group === PL) {
                    vars.add(obj.value);
                }
                else if(group === EX) { 
                    if(!isNaN(obj.value)) vars.add(obj.value);
                    variables(obj.power, vars);
                }
                else if(group === FN) {
                    for(var i=0; i<obj.args.length; i++) {
                        variables(obj.args[i], vars);
                    }
                }
            }
            return vars.c.sort();
        },
        
        each = Utils.each = function(obj, fn) {
            if(isArray(obj)) {
                var l = obj.length;
                for(var i=0; i<l; i++) fn.call(obj, i);
            }
            else {
                for(var x in obj) if(obj.hasOwnProperty(x)) fn.call(obj, x);
            }
        },
        
        even = Utils.even = function(num) {
            return num % 2 === 0;
        },
        
        evenFraction = Utils.evenFraction = function(num) {
            return 1/( num % 1) % 2 === 0;
        },
        
        arrayUnique = Utils.arrayUnique = function(arr) {
            var l = arr.length, a = [];
            for(var i=0; i<l; i++) {
                item = arr[i];
                if(a.indexOf(item) === -1) a.push(item);
            }
            return a;
        },
        
        reserveNames = Utils.reserveNames = function(obj) {
            var add = function(item) {
                if(RESERVED.indexOf(item) === -1) RESERVED.push(item);
            };
            
            if(typeof obj === 'string') add(obj);
            else {
                each(obj, function(x) {
                    add(x);
                });
            }  
        },
        
        // Removes an item from either an array or an object.
        // If an array the index must be specified after the array.
        // If an object the key must be specified
        remove = Utils.remove = function( obj, indexOrKey ) {
            var result;
            if( isArray(obj) ) {
                result =  obj.splice(indexOrKey, 1)[0];
            }
            else {
                result = obj[indexOrKey];
                delete obj[indexOrKey];
            }
            return result;
        },
        
        block = Utils.block = function(setting, f, opt, obj) {
            var current_setting = Settings[setting];
            Settings[setting] = opt === undefined ? true : !! opt;
            var retval = f.call(obj);
            Settings[setting] = current_setting;
            return retval;
        },

        arguments2Array = Utils.arguments2Array = function(obj) {
            return [].slice.call(obj);
        },
        
        //Using a regex to get between brackets can be a bit tricky. This functions makes it more abstract
        //to fetch between brackets within a string from any given index. If the starting index is
        //a bracket then it will fail. returns [matched_string, first_bracket_index, end_bracket_index]
        betweenBrackets = function(ob, cb, str, start) {
            start = start || 0;
            var l = str.length,
                open = 0, fb;
            for(var i=start; i<l; i++) {
                var ch = str.charAt(i); //get the character at this position

                if(ch === ob) { //if an open bracket was found
                    if(fb === undefined) fb = i+1;//mark the first bracket found
                    open++; //mark a new open bracket
                }
                if(ch === cb) { //if a close bracket was found
                    open--; //close a bracket
                    if(open === 0 && fb !== undefined) {
                        var nb = i;
                        return [str.substring(fb, nb), fb, nb];
                    }
                }
            }
            return [];
        },
        
        format_subs = function(subs) {
            for(var x in subs) subs[x] = _.parse(subs[x].toString());
            return subs;
        },
        
        //Inverse trig functions
        Math2 = {
            csc: function(x) { return 1/Math.sin(x); },
            sec: function(x) { return 1/Math.cos(x); },
            cot: function(x) { return 1/Math.tan(x); },
            //https://gist.github.com/kcrt/6210661
            erf: function(x){
                // erf(x) = 2/sqrt(pi) * integrate(from=0, to=x, e^-(t^2) ) dt
                // with using Taylor expansion,
                // = 2/sqrt(pi) * sigma(n=0 to +inf, ((-1)^n * x^(2n+1))/(n! * (2n+1)))
                // calculationg n=0 to 50 bellow (note that inside sigma equals x when n = 0, and 50 may be enough)
                var m = 1.00,
                    s = 1.00,
                    sum = x * 1.0;
                for(var i = 1; i < 50; i++){
                m *= i;
                s *= -1;
                sum += (s * Math.pow(x, 2.0 * i + 1.0)) / (m * (2.0 * i + 1.0));
                }
                return 2 * sum / Math.sqrt(3.14159265358979);
            },
            fact: function(x) {
                var retval=1;
                for (var i = 2; i <= x; i++) retval = retval * i;
                return retval;
            },
            mod: function(x, y) {
                return x % y;
            },
            GCD: function() {
                var args = [].slice.call(arguments)
                        .map(function(x){ return Math.abs(x); }).sort(),
                    a = Math.abs(args.shift()),
                    n = args.length;

                while(n-- > 0) {
                    var b = Math.abs(args.shift());
                    while(true) {
                        a %= b;
                        if (a === 0) {
                            a = b;
                            break;
                        }
                        b %= a;
                        if (b === 0) break;;
                    }
                }
                return a;
            }
        };
        reserveNames(Math2); //reserve the names in Math2
        
    /* GLOBAL FUNCTIONS */
    function text(obj, option) { 
        var asHash = (option === 'hash'),
            finalize = option === 'final';
        //if the object is a symbol
        if(isSymbol(obj)) { 
            var multiplier = '', 
            power = '',
            sign = '',
            group = obj.group,
            value = obj.value;
            //if the value is to be used as a hash then the power and multiplier need to be suppressed
            if(!asHash) { 
                var om = obj.multiplier;
                if(om === -1) {
                    sign = '-';
                    om = 1;
                }
                //only add the multiplier if it's not 1
                if(om !== 1) multiplier = om;

                var p = obj.power;
                //only add the multiplier 
                if(p !== 1) {
                    //is it a symbol
                    if(isSymbol(p)) {
                        power = text(p);
                    }
                    else {
                        power = p;
                    }
                }
            }

            switch(group) {
                case N:
                    multiplier = '';
                    //if it's numerical then all we need is the multiplier
                    value = obj.multiplier === -1 ? 1 : obj.multiplier;
                    power = '';
                    break;
                case PL:
                    value = obj.collectSymbols(text).join('+').replace('+-', '-');
                    break;
                case CP:
                    value = obj.collectSymbols(text).join('+').replace('+-', '-');
                    break;
                case CB: 
                    value = obj.collectSymbols(function(symbol){
                        var g = symbol.group;
                        //both groups will already be in brackets if their power is greater than 1
                        //so skip it.
                        if((g === PL || g === CP) && (symbol.power === 1 && symbol.multiplier === 1)) {
                            return inBrackets(text(symbol));
                        }
                        return text(symbol);
                    }).join('*');
                    break;
                case EX:
                    var pg = obj.previousGroup,
                        pwg = obj.power.group;
                    //PL are the exception. It's simpler to just collect and set the value
                    if(pg === PL) value = obj.collectSymbols(text).join('+').replace('+-', '-');
                    if(!(pg === N || pg === S || pg === FN)) { value = inBrackets(value); }
                    if((pwg === CP || pwg === CB || pwg === PL || obj.power.multiplier !== 1) && power) {
                        power = inBrackets(power);
                    }
                    break;
            }


            //the following groups are held together by plus or minus. The can be raised to a power or multiplied
            //by a multiplier and have to be in brackets to preserve the order of precedence
            if(((group === CP || group === PL) && (multiplier && multiplier !== 1)) 
                    || ((group === CB || group === CP || group === PL) && (power && power !== 1))
                    || obj.baseName === PARENTHESIS) { 
                value = inBrackets(value);
            }

            if(power < 0) power = inBrackets(power);
            if(multiplier) multiplier = multiplier + '*';
            if(power) power = '^' + power;

            return sign+multiplier+value+power;
        }
        else {
            return obj;
        }
    }
    Utils.text = text;
    /* END GLOBAL FUNCTIONS */
    
    /* CLASSES */
    function Collector(extra_conditions) {
        this.c = [];
        this.add = function(value) {
            var condition_true = extra_conditions ? extra_conditions(value) : true;
            if(this.c.indexOf(value) === -1 && condition_true) this.c.push(value);
        };
    }
    
    function Func(fn_name) {
        this.name = fn_name;
    }
    
    /** 
     * 
     * @param {Symbol} symbol
     * @returns {Expression} wraps around the Symbol class
     */
    function Expression(symbol) {
        this.symbol = symbol;
    }
    
    Expression.getExpression = function(expression_number, asType) {
        if(expression_number === 'last' || !expression_number) expression_number = EQNS.length;
        if(expression_number === 'first') expression_number = 1;
        var index = expression_number -1,
            expression = EQNS[index],
            retval = expression ? new Expression(expression) : expression;
        return retval;
    };
    
    Expression.prototype = {
        text: function() {
            return this.symbol.text('final');
        },
        
        latex: function() {
            return Latex.latex(this.symbol);
        },
        
        valueOf: function() {
            return this.symbol.valueOf();
        },
        
        evaluate: function() {
            var first_arg = arguments[0], expression, idx = 1;
            if(typeof first_arg === 'string') {
                expression = (first_arg.charAt(0) === '%') ? Expression.getExpression(first_arg.substr(1)).text() : first_arg;
            }
            else if(first_arg instanceof Expression || isSymbol(first_arg)) {
                expression = first_arg.text();
            }
            else {
                expression = this.symbol.text(); idx--;
            }
            
            var subs = arguments[idx];

            return new Expression(block('PARSE2NUMBER', function() {
                return _.parse(expression, format_subs(subs));
            }, true));
        },
        
//        evaluate: function(subs) {
//            var self = this;
//            return new Expression(block('PARSE2NUMBER', function() {
//                return _.parse(self.symbol.text(), format_subs(subs));
//            }, true));
//        },
        
        buildFunction: function(vars) {
            return build(this.symbol, vars);
        },
        
        isNumber: function() {
            return isNumericSymbol(this.symbol);
        },
        
        isInfinity: function() {
            return Math.abs(this.symbol.multiplier) === Infinity;
        },
        
        variables: function() {
            return variables(this.symbol);
        },
        
        toString: function() {
            return this.symbol.text();
        },
        
        isMonomial: function() {
            return this.symbol.group === S;
        },
        
        isFraction: function() {
            return isFraction(this.symbol);
        },
        
        isPolynomial: function() {
            return this.symbol.isPoly();
        }
    };
    /**
     * 
     * @param {String} obj An attempt to get objects to behave somewhat as "real" symbols
     * @returns {Symbol}
     */
    function Symbol(obj) { 
        //this enables the class to be instanciated without the new operator
        if(!(this instanceof Symbol)) { return new Symbol(obj); };
        
        //define numeric symbols
        if(!isNaN(obj)) {
            this.group = N;
            this.value = '#'; 
            this.multiplier = Number(obj);
        }
        //define symbolic symbols
        else {
            //imaginary values. 
            if(obj === 'i') {
                this.isImgSymbol = true;
            }
            this.group = S; 
            validateName(obj); 
            this.value = obj;
            this.multiplier = 1;
            this.power = 1;
        }
        // Added to silence the strict warning.
        return this; 
    }
    
    Symbol.prototype = {
        coeffs: function() {
            var c = [];
            if(this.symbols) {
                for(var x in this.symbols) {
                    c.push(this.symbols[x].multiplier);
                }
            }
            else c.push(this.multiplier);
            return c;
        },
        equals: function(symbol) {
            return this.value === symbol.value && text(this.power) === text(symbol.power);
        },
        isPoly: function() {
            var status = false;
            if( this.group === S && this.power > 0 || this.group === N) {
                status = true;
            }
            else {
                var k = keys( this.symbols ).sort(),
                    kl = k.length;
                 //the following assumptions are made in the next check
                 //1. numbers are represented by an underscore
                 //2. variable and function names must start with a letter
                if(kl === 2 && k[0] === '#') { 
                    status = this.symbols[k[1]].isPoly();
                }
                else if( this.group === PL ) { 
                    status = true;
                    for( var i=0; i<kl; i++ ) {
                        if( k[i] < 0 ) { status = false; }
                    }
                }
            }
            return status;
        },
        isInverse: function() {
            if(this.group === EX) return (this.power.multiplier < 0);
            return this.power < 0;
        },
        // Copies over a predefined list of properties from one symbol to another.
        copy: function() { 
            var copy = new Symbol(0),
                //list of properties excluding power as this may be a symbol and would also need to be a copy.
                properties = [
                    'multiplier', 'value', 'group', 'length', 'previousGroup', 'isImgSymbol', 'baseName', 'args'],
                l = properties.length, i;
            if(this.symbols) {
                copy.symbols = {};
                for(var x in this.symbols) {
                    copy.symbols[x] = this.symbols[x].copy();
                }
            }

            for(i=0; i<l; i++) {
                if(this[properties[i]] !== undefined) {
                    copy[properties[i]] = this[properties[i]];
                }
            }

            if(this.power) {
                copy.power = isSymbol(this.power) ? this.power.copy() : this.power;
            }
            return copy;
        },
        each: function(fn) {
            for(var x in this.symbols) {
                fn.call(this, this.symbols[x], x);
            }
        },
        valueOf: function() {
            if(this.group === N) { return this.multiplier; }
            else if(this.power === 0){ return 1; }
            else if(this.multiplier === 0) { return 0; }
            else { return text(this); }
        },
        //a function to help sniff out symbols in complex symbols
        //pass in true as second parameter to include exponentials
        contains: function(variable, all) { 
            var g = this.group; 
            if(this.symbols) {
                for(var x in this.symbols) { if(this.symbols[x].contains(variable, all)) return true; }
            }
            else if(g === FN || this.previousGroup === FN) {
                for(var i=0; i<this.args.length; i++) { if(this.args[i].contains(variable, all)) return true; }
            }
            else if(g === EX) { 
                //exit only if it does
                if(all && this.power.contains(variable, all)) { return true; }
                return this.value === variable;
            }
            
            return this.value === variable;
        },
        negate: function() { 
            this.multiplier *= -1;
            if(this.group === CP || this.group === PL) this.distributeMultiplier();
            return this;
        },
        invert: function(power_only) {
            //invert the multiplier
            if(!power_only) this.multiplier = 1/this.multiplier;
            //invert the rest
            if(isSymbol(this.power)) {
                this.power.negate();
            }
            else {
                if(this.power) this.power *= -1;
            }
            return this;
        },
        distributeMultiplier: function() {
            if(this.symbols && this.power === 1 && this.group !== CB) {
                for(var x in this.symbols) {
                    var s = this.symbols[x];
                    s.multiplier *= this.multiplier;
                    s.distributeMultiplier();
                }
                this.multiplier = 1;
            }

            return this;
        },
        distributeExponent: function() {
            if(this.power !== 1) {
                var p = this.power;
                for(var x in this.symbols) {
                    var s = this.symbols[x];
                    if(s.group === EX) {
                        s.power = _.multiply(s.power, new Symbol(p));
                    }
                    else {
                        this.symbols[x].power *= p;
                    }
                }
                this.power = 1;
            }
            return this;
        },
        convert: function(group) { 
            if(group > FN) { 
                //make a copy of this symbol;
                var cp = this.copy();
                //attach a symbols object and upgrade the group
                this.symbols = {};

                if(group === CB) {
                    //symbol of group CB hold symbols bound together through multiplication
                    //because of commutativity this multiplier can technically be anywhere within the group
                    //to keep track of it however it's easier to always have the top level carry it
                    cp.multiplier = 1;
                }
                else {
                    //reset the symbol
                    this.multiplier = 1;
                }

                if(this.group === FN) {
                    cp.args = this.args; 
                    delete this.args;
                    delete this.baseName;
                }

                //the symbol may originate from the symbol i but this property no longer holds true
                //after copying
                if(this.isImgSymbol) delete this.isImgSymbol;

                this.power = 1;
                //attach a copy of this symbol to the symbols object using its proper key
                this.symbols[cp.keyForGroup(group)] = cp; 
                this.group = group;
                //objects by default don't have a length property. However, in order to keep track of the number
                //of sub-symbols we have to impliment our own.
                this.length = 1;    
            }
            else if(group === EX) {
                //1^x is just one so check and make sure
                if(!(this.group === N && Math.abs(this.multiplier) === 1)) {
                    this.previousGroup = this.group;
                    if(this.group === N) {
                        this.value = this.multiplier;
                        this.multiplier = 1;
                    }
                    
                    this.group = EX;
                }
            }
            else if(group === N) {
                for(var x in this) {
                    if(this.hasOwnProperty(x) && (x !== 'value' && x !== 'multiplier')) delete this[x];
                }
                this.value = '#';
                this.group = N;
            }
        },
        insert: function(symbol, action) { 
            //this check can be removed but saves a lot of aggravation when trying to hunt down
            //a bug. If left you will instantly know that the error can only be between 2 symbols.
            if(!isSymbol(symbol)) error('Object '+symbol+' is not of type Symbol!');
            if(this.symbols) {
                var group = this.group;
                if(group > FN) {
                    var key = symbol.keyForGroup(group); 
                    var existing = this.symbols[key]; //check if there's already a symbol there
                        
                    if(action === 'add') {
                        var hash = key;
                        if(existing) { 
                            //add them together using the parser
                            this.symbols[hash] = _.add(existing, symbol);
                            //if the addition resulted in a zero multiplier remove it
                            if(this.symbols[hash].multiplier === 0) {
                                delete this.symbols[hash];
                                this.length--;
                                
                                if(this.length === 0) {
                                    this.convert(N);
                                    this.multiplier = 0;
                                }
                            }
                        }
                        else {
                            this.symbols[key] = symbol;
                            this.length++;
                        }  
                            
                    }
                    else {
                        if(existing) {  
                            //remove because the symbol may have changed
                            symbol = _.multiply(remove(this.symbols, key), symbol);
                            
                            if(this.length === 0) this.convert(N);
                            this.length--;
                            //clean up
                        }
                        //transfer the multiplier
                        this.multiplier *= symbol.multiplier;
                        symbol.multiplier = 1;
                        
                        if(Math.abs(symbol.valueOf()) !== 1) { 
                            if(this.power !== 1) {
                                var cp = this.copy();
                                cp.multiplier = 1; 
                                this.power = 1;
                                this.symbols = {};
                                var key2 = cp.keyForGroup(CB);
                                this.symbols[key2] = cp;
                            }
                            
                            //if the power does not equal to zero then we have to create a new symbol
                            this.symbols[key] = symbol;
                            this.length++;
                        }
                        
                    }
                    //update the hash
                    if(this.group === CP || this.group === CB) {
                        this.updateHash();
                    }
                }
            }
        },  
        attach: function(symbol) {
            this.insert(symbol, 'add');
        },
        combine: function(symbol) {
            this.insert(symbol, 'multiply');
        },
        updateHash: function() {
            if(this.group === FN) {
                var contents = '',
                    args = this.args,
                    is_parens = this.baseName === PARENTHESIS;
                for(var i=0; i<args.length; i++) contents += (i===0 ? '' : ',')+text(args[i]);
                var fn_name = is_parens ? '' : this.baseName;
                this.value = fn_name+(is_parens ? contents : inBrackets(contents));
            }
            else if(!(this.group === S || this.group === PL)) {
                this.value = text(this, 'hash');
            }
        },
        //this function defines how every group in stored within a group of higher order
        keyForGroup: function(group) {
            var g = this.group;
            if(g === N) {
                return this.value;
            }
            else if(g === S) {
                if(group === PL) return this.power;
                else return this.value;
            }
            else if(g === FN) {
                if(group === PL) return this.power;
                return text(this, 'hash');
            }
            else if(g === PL) { 
                //if the order is reversed then we'll assume multiplication
                //TODO: possible future dilemma
                if(group === CB) return text(this, 'hash');
                if(group === CP) {
                    if(this.power === 1) return this.value;
                    else return inBrackets(text(this, 'hash'))+'^'+this.power;
                }
                return this.value;
            }
            else if(g === CP) {
                if(group === CP) return text(this, 'hash');
                if(group === PL) return this.power;
                return this.value;
            }
            else if(g === CB) {
                if(group === PL) return this.power;
                return text(this, 'hash');
            }
            else if(g === EX) {
                if(group === PL) return text(this.power);
                return text(this, 'hash');
            }
        },
        //this function simply collects all the symbols and returns them as an array
        //if a function is supplied then that function is called on every symbol;
        collectSymbols: function(fn) { 
            var collected = [];
            for(var x in this.symbols) {
                var symbol = this.symbols[x];
                collected.push( fn ? fn(symbol) : symbol );
            }
            return collected.sort();//sort hopefully gives us some sort of consistency
        },
        text: function() {
            return text(this);
        },
        isOne: function() {
            if(this.group === N) return this.multiplier === 1;
            else return this.power === 0;
        },
        getDenom: function() {
            if(this.group === CB) {
                for(var x in this.symbols) {
                    if(this.symbols[x].power < 0) return this.symbols[x];
                }
            }
        },
        toString: function() {
            return this.text();
        }
    };
    
    function Operator(val, fn, precedence, left_assoc, is_prefix, is_postfix) {
        this.val = val;
        this.fn = fn;
        this.precedence = precedence;
        this.left_assoc = left_assoc;
        this.is_prefix = is_prefix;
        this.is_postfix = is_postfix || false;
    }

    Operator.prototype = {
        toString: function() { return this.val; }
    };

    function Prefix(val) {
        this.val = val;
    }
    
    Prefix.prototype = {
        resolve: function(obj) {
            if(this.val === '-') {
                return obj.negate();
            }
            return obj;
        }
    };

    //Uses modified shunting-yard algorithm. http://en.wikipedia.org/wiki/Shunting-yard_algorithm
    function Parser(){
        var _ = this,
            bin = {},
            constants = this.constants = {
                PI: Math.PI,
                E:  Math.E
            };
        
        var operators = {
                '^': new Operator('^', 'pow', 4, false, false),
                '*': new Operator('*', 'multiply', 3, true, false),
                '/': new Operator('/', 'divide', 3, true, false),
                '+': new Operator('+', 'add', 2, true, true),
                '-': new Operator('-', 'subtract', 2, true, true),
                ',': new Operator(',', 'comma', 1, true, false)
            },

            // Supported functions.
            // Format: function_name: [mapped_function, number_of_parameters]
            functions = this.functions = {
                'cos'       : [ , 1],
                'sin'       : [ , 1],
                'tan'       : [ , 1],
                'sec'       : [ , 1],
                'csc'       : [ , 1],
                'cot'       : [ , 1],
                'acos'      : [ , 1],
                'asin'      : [ , 1],
                'atan'      : [ , 1],
                'exp'       : [ , 1],
                'min'       : [ , -1],
                'max'       : [ ,-1],
                'erf'       : [ , 1],
                'floor'     : [ ,1],
                'ceiling'   : [ ,1],
                'fact'      : [ , 1],
                'round'     : [ , 1],
                'mod'       : [ , 2],
                'vector'    : [vector, -1],
                'parens'    : [parens, -1],
                'sqrt'      : [sqrt, 1],
                'log'       : [log , 1],
                'abs'       : [abs , 1]
            };
        
        var brackets = {},

            last_item_on = function(stack) {
                return stack[stack.length-1];
            };
        
        var LEFT_PAREN = '(',
            RIGHT_PAREN = ')',
            LEFT_SQUARE_BRACKET = '[',
            RIGHT_SQUARE_BRACKET = ']',
            scientific_numbers = [];
                
            brackets[LEFT_PAREN] = LEFT_PAREN,
            brackets[RIGHT_PAREN] = RIGHT_PAREN,
            brackets[LEFT_SQUARE_BRACKET] = LEFT_SQUARE_BRACKET,
            brackets[RIGHT_SQUARE_BRACKET] = RIGHT_SQUARE_BRACKET;

        this.error = error;
        
        this.override = function(which, with_what) {
            if(!bin[which]) bin[which] = [];
            bin[which].push(this[which]);
            this[which] = with_what;
        };
        
        this.restore = function(what) {
            if(this[what]) this[what] = bin[what].pop();
        };
        
        this.extend = function(what, with_what, force_call) {
            var _ = this,
                extended = this[what];
            if(typeof extended === 'function' && typeof with_what === 'function') {
                var f = this[what];
                this[what] = function(a, b) {
                    if(isSymbol(a) && isSymbol(b) && !force_call) return f.call(_, a, b);
                    else return with_what.call(_, a, b, f);
                };
            }
        };
        
        this.symfunction = function(fn_name, params) { 
            //call the proper function and return the result;
            var f = new Symbol(fn_name);
            f.group = FN;
            if(typeof params === 'object') params = [].slice.call(params);//ensure an array
            
            f.args = params;
            f.baseName = fn_name;
            f.updateHash();
            return f;
        };

        this.callfunction = function(fn_name, args) { 
            var fn_settings = functions[fn_name];
            
            if(!fn_settings) error(fn_name+' is not a supported function.');
            
            var num_allowed_args = fn_settings[1],
                fn = fn_settings[0],
                retval;

            if(!(args instanceof Array)) args = args !== undefined ?  [args] : [];

            if(num_allowed_args !== -1) {
                var is_array = isArray(num_allowed_args),
                    min_args = is_array ? num_allowed_args[0] : num_allowed_args,
                    max_args = is_array ? num_allowed_args[1] : num_allowed_args,
                    num_args = args.length;
                var error_msg = fn_name+' requires a {0} of {1} arguments. {2} provided!';
                if(num_args < min_args) error(format(error_msg, 'minimum', min_args, num_args));
                if(num_args > max_args) error(format(error_msg, 'maximum', max_args, num_args));
            }
            
            if(fn) { retval = fn.apply(fn_settings[2] || this, args); }
            else {
                if(Settings.PARSE2NUMBER) {
                    try { 
                        args = args.map(function(symbol) { 
                            if(symbol.group === N) return symbol.multiplier;
                            else error('Symbol must be of group N.');
                        });
                        var f = Math[fn_name] ? Math[fn_name] : Math2[fn_name];
                        retval = new Symbol(f.apply(undefined, args));
                    }
                    catch(e){ 
                        retval = this.symfunction(fn_name, args); 
                    }
                }
                else {
                    retval = this.symfunction(fn_name, args);
                }
            }
            return retval;
        };
        
        this.powerAdd = function(symbol, value, thisIsEX) {
            var isNumeric = !isNaN(value);
            if(!isNumeric || thisIsEX || isSymbol(symbol.power)) {
                var p = !isSymbol(value) ? new Symbol(value) : value;
                symbol.power = _.add(symbol.power, p);
            }
            else {
                symbol.power += value;
            }
            
            if(symbol.power.valueOf() === 0) symbol.convert(N);
        };
        
        this.parse = function(expression_string, substitutions) {  
            //Since variables cannot start with a number, the assumption is made that when this occurs the
            //user intents for this to be a coefficient. The multiplication symbol in then added. The same goes for 
            //a side-by-side close and open parenthesis
            expression_string = expression_string.split(' ').join('')//strip empty spaces
                    .replace(/\d*\.*\d+e[\+\-]*\d+/gi, function(match, start, str) {
                        if(/[a-z_]/.test(str.charAt(start-1))) return match;
                        scientific_numbers.push(match);
                        return '&';
                    })
                    //allow omission of multiplication after coefficients
                    .replace(/([\+\-\/\*]*[0-9]+)([a-z_]+[\+\-\/\*]*)/gi, function() {
                        var str = arguments[4],
                            group1 = arguments[1],
                            group2 = arguments[2],
                            start = arguments[3],
                            first = str.charAt(start),
                            before = '',
                            d = '*';
                        if(!first.match(/[\+\-\/\*]/)) before = str.charAt(start-1);
                        if(before.match(/[a-z]/i)) d = '';
                        return group1+d+group2;
                    })
                    //allow omission of multiplication sign between brackets
                    .replace( /\)\(/g, ')*(' );

            var subs = substitutions || {},
                stack = [],
                output = [],
                len = expression_string.length,
                pos = 0,
                last_opr_pos,
                last_operator,
                last_char,
                EOT = false,
                func_on_stack = false,
                curpos = 0,
                                
                evaluate = function(operator) { 
                    if(!operator) {
                        operator = stack.pop();
                    }

                    var symbol2 = output.pop(),
                        symbol1 = output.pop();

                    if(!operator && !symbol1 && symbol2) {
                        insert(symbol2);
                    }
                    else if(operator === LEFT_PAREN) { 
                        if(EOT) error('Unmatched open parenthesis!');
                        stack.push(operator);
                        insert(symbol1);
                        insert(symbol2);
                    }
                    else {
                        var ofn = operator.fn, result;
                        if(!ofn) result = operator.resolve(symbol2);//it's the first symbol and negative
                        else result = _[ofn].call(_, symbol1, symbol2);
                        insert(result);
                    }    
                },

                insert = function(token) { 
                    //if the number is a scientifc number then use that instead
                    if(/&/.test(token)) {
                        token = scientific_numbers.shift();
                    }
                    
                    //when two operators are close to each other then the token will be empty or when we've gone
                    //out of range inside of the output or stack. We have to make sure the token even exists before entering.
                    if(token !== '' && token !== undefined) { 
                        //this could be function parameters or a vector
                        if(!(token instanceof Array)) { 
                            if(!(token instanceof Symbol) && !(customType(token))) {
                                var sub = subs[token] || VARS[token]; //handle substitutions
                                token = sub ? sub.copy() : new Symbol(token);
                            }
                        }
                            
                        //resolve prefixes
                        while(last_item_on(stack) instanceof Prefix) {
                            //if there's a function on the output stack then check the next operator 
                            if(func_on_stack) {
                                //check the next operator to come
                                var next_operator = operators[expression_string.charAt(curpos+1)];
                                if(next_operator && !next_operator.left_assoc) break;
                            }
                            if(operator && !operator.left_assoc) break; //don't touch pow
                            var prefix = stack.pop();
                            token = prefix.resolve(token);
                        }
                        
                        output.push(token);
                        func_on_stack = false;//thank you for your service
                    } 
                };
                
            if(!subs['~']) {   
                //collect the substitutions
                for(var x in constants) subs[x] = new Symbol(constants[x]);
            }
            
            for(curpos=0; curpos<len; curpos++) { 
                var cur_char = expression_string.charAt(curpos);
                var operator = operators[cur_char], //a possible operator
                    bracket = brackets[cur_char]; //a possible bracket
                //if the character is a bracket or an operator but not a scientific number
                if(operator || bracket) {
                    //if an operator is found then we assume that the preceeding is a variable
                    //the token has to be from the last position up to the current position
                    var token = expression_string.substring(pos,curpos);

                    if(bracket === LEFT_PAREN && token || bracket === LEFT_SQUARE_BRACKET) {
                        var f = bracket === LEFT_SQUARE_BRACKET ? VECTOR : token;
                        stack.push(new Func(f), LEFT_PAREN);
                        pos = curpos+1;
                        last_opr_pos = curpos; 
                        continue;
                    }
                    //place the token on the output stack. 
                    //This may be empty if we're at a unary or bracket so skip those.
                    insert(token);

                    //if the preceding token is a operator
                    if(!bracket && (curpos-last_opr_pos === 1 || curpos === 0)) { 
                        if(operator.is_prefix) {
                            stack.push(new Prefix(operator.val));
                            pos = curpos+1;
                            last_opr_pos = curpos;
                            continue;
                        }
                        error(operator.val+' is not a valid prefix operator!:'+pos); 
                    }
                    
                    if(cur_char !== RIGHT_PAREN) last_opr_pos = curpos; //note that open brackets count as operators in this case

                    if(operator) { 
                        //we may be at the first operator and last operator may be undefined in which case do nothing
                        //other than recording the last operator and placing the operator on the stack.
                        if(last_operator) { 
                            if(operator.left_assoc && operator.precedence <= last_operator.precedence ||
                                    !operator.left_assoc && (operator.precedence < last_operator.precedence)) {
                                var done = false;
                                do {
                                    evaluate(); 
                                    var last = last_item_on(stack); 
                                    //stop when you see a parethesis
                                    if(last === LEFT_PAREN) break;
                                    
                                    done = last ? last.left_assoc && last.precedence < operator.precedence: true;
                                }
                                while(!done);  
                            }
                        }
                        stack.push(operator);
                        last_operator = last_item_on(stack);
                    }
                    else {
                        if(cur_char === LEFT_PAREN) {
                            stack.push(bracket);
                        }
                        else if(cur_char === RIGHT_PAREN || cur_char === RIGHT_SQUARE_BRACKET) { 
                            last_opr_pos = null;
                            var found_matching = false;
                            while(!found_matching) {
                                var popped = stack.pop();
                                
                                if(popped === undefined) error('Unmatched close bracket or parenthesis!');

                                if(popped === LEFT_PAREN) {
                                    found_matching = true;
                                }
                                else evaluate(popped);
                                //Let's close the barn door after the horses left but it's still better than nothing.
                                //Bracket parity checking was an afterthought in the current design. I'll address this
                                //in the future when I switch to a full parser.
                                if(popped === LEFT_PAREN && cur_char === RIGHT_SQUARE_BRACKET) {
                                    var lsi = last_item_on(stack);
                                    if(!lsi || lsi.name !== VECTOR) error('Unmatched parenthesis!');
                                }
                            }
                            
                            var last_stack_item = last_item_on(stack);

                            if(last_stack_item instanceof Func) { 
                                //TODO: really really really fix bracket parity checking
                                if(last_stack_item.name === VECTOR && cur_char !== RIGHT_SQUARE_BRACKET)
                                    error('Unmatched bracket!');
                                var v = _.callfunction(stack.pop().name, output.pop()); 
                                func_on_stack = true;
                                insert(v);//go directly to output as this will cause the prefix to prematurely be evaluated
                            }
                        }
                        last_operator = last_item_on(stack);
                    } 
                    
                    pos = curpos+1; //move along
                }
                else if(curpos === len-1) {
                    insert(expression_string.substring(pos, curpos+1));
                }
                last_char = cur_char;
            }
            
            EOT = true; //end of tokens/stack reached
            
            while(stack.length > 0) { 
                evaluate();
            }
            
            return output[0];
        };

        //FUNCTIONS
        function parens(symbol) {
            if(Settings.PARSE2NUMBER) {
                return symbol;
            }
            return _.symfunction('parens', [symbol]);
        }
        
        function abs(symbol) {
            if(symbol.multiplier < 0) symbol.multiplier *= -1;
            if(isNumericSymbol(symbol) || even(symbol.power)) {
                return symbol;
            }
            return _.symfunction(ABS, [symbol]);
        }
        
        function sqrt(symbol) {
            return _.pow(symbol, new Symbol('0.5'));
        }
        
        function log(symbol) { 
            var retval;
            if(symbol.group === FN && symbol.baseName === 'exp') {
                var s = symbol.args[0];
                if(symbol.multiplier === 1) retval = _.multiply(s, new Symbol(symbol.power));
                else retval = _.symfunction('log',[symbol]);
            }
            else if(Settings.PARSE2NUMBER && isNumericSymbol(symbol)) {
                var img_part;
                if(symbol.multiplier < 0) {
                    symbol.negate();
                    img_part = _.multiply(new Symbol(Math.PI), new Symbol('i'));
                }
                retval = new Symbol(Math.log(symbol.multiplier));
                if(img_part) retval = _.add(retval, img_part);
            }
            else {
                retval = _.symfunction('log', arguments); 
            }

            return retval;
        }

        function vector() {
            return new Vector([].slice.call(arguments));
        }
        
        this.ext = {
            log: log,
            sqrt: sqrt,
            abs: abs,
            vector: vector,
            parens: parens
        };
        
        this.mapped_function = function() { 
            var subs = {},
                params = this.params;
            for(var i=0; i<params.length; i++) subs[params[i]] = arguments[i];
            return _.parse(this.body, subs);
        };

        this.unpack = function(symbol) { 
            //we only touch this bad boy if the power is one 
            if(symbol.power === 1) {
                //parens should only carry one symbol
                var unpacked = symbol.args[0];
                unpacked.multiplier *= symbol.multiplier;
                symbol = unpacked;
            }
            return symbol;
        };

        this.add = function(symbol1, symbol2) { 
            var group1 = symbol1.group, 
                group2 = symbol2.group;

            //deal with zero addition
            if(symbol1.multiplier === 0) return symbol2;
            if(symbol2.multiplier === 0) return symbol1;
            
            //parens is a function that we want to get rid of as soon as possible so check
            if(group1 === FN && symbol1.baseName === PARENTHESIS) symbol1 = this.unpack(symbol1);
            if(group2 === FN && symbol1.baseName === PARENTHESIS) symbol2 = this.unpack(symbol2);
            
            //always have the lower group on the left
            if(group1 > group2) { return this.add(symbol2, symbol1); }
            if(Settings.SAFE){ symbol1 = symbol1.copy(); symbol2 = symbol2.copy(); };
            
            //same symbol, same power
            if(symbol1.value === symbol2.value && !(group1 === CP && symbol1.power !== symbol2.power)) {
                if(symbol1.power === symbol2.power && group2 !== PL /*if group1 is PL then group2 is PL*/
                        || (group1 === EX && symbol1.equals(symbol2))) {
                    symbol1.multiplier += symbol2.multiplier;
                    //exit early
                    if(symbol1.multiplier === 0) symbol1 = Symbol(0);
                }
                else if(group2 === PL) {
                    if(group1 === PL) {
                        if(symbol1.power ===1 && symbol2.power === 1) {
                            symbol1.distributeMultiplier();
                            symbol2.distributeMultiplier();
                            for(var s in symbol2.symbols) {
                                symbol1.attach(symbol2.symbols[s]);
                            }
                        }
                        else if(symbol1.power === symbol2.power) {
                            symbol1.multiplier += symbol2.multiplier;
                        }
                        else {
                            if(symbol1.power > symbol2.power) { var t = symbol1; symbol1 = symbol2; symbol2 = t; /*swap*/}
                            symbol1.convert(CP); 
                            symbol1.attach(symbol2);
                        } 
                    }
                    else {
                        if(symbol2.multiplier === 1) {
                            symbol2.attach(symbol1);
                        }
                        else {
                            //force the multiplier downhill
                            for(var s in symbol2.symbols) {
                                symbol2.symbols[s].multiplier *= symbol2.multiplier;
                            }
                            symbol2.multiplier = 1;
                            symbol2.attach(symbol1);
                        }
                        symbol1 = symbol2;
                    }
                }
                else { 
                    //we checkfor CB on the right or S on the left because we know that the lower group is always 
                    //on the left. This is just an extra precaution
                    symbol1.convert(PL);
                    symbol1.attach(symbol2);
                }
            }
            else if(group2 === CP) { 
                if(group1 === CP) { 
                    if(symbol1.power > symbol2.power) { 
                        var t = symbol1; symbol1 = symbol2; symbol2 = t;/*swap them*/ 
                    }
                    
                    if(symbol1.value === symbol2.value) { 
                        //we checkfor CB on the right or S on the left because we know that the lower group is always 
                        //on the left. This is just an extra precaution
                        symbol1.convert(PL);
                        symbol1.attach(symbol2);
                    }
                    else if(symbol1.power === 1) {
                        //since we swap the symbols to place the lower power symbol on the left we only have to check a
                        if(symbol2.power === 1) { 
                            var s;
                            //distribute the multiplier. The hope is that you don't end up delaying it only to end up with
                            //a very complex symbol in the end. The symbol simplifies immediately if there's any subtraction.
                            symbol1.distributeMultiplier();
                            symbol2.distributeMultiplier();
                            for(s in symbol2.symbols) {
                                //this order is chosen because the chances of the sub-symbol being of a lower
                                //group are higher
                                this.add(symbol2.symbols[s], symbol1);
                            }
                        }
                        else {
                            //but a still has a power of 1 so attach it
                            symbol1.attach(symbol2);
                        }
                    }
                    else { 
                        //aaahhh we've reached the end of the dodging and weaving an it's time to start creating
                        var newSymbol = new Symbol('blank');
                        newSymbol.symbols = {};
                        newSymbol.length = 1;
                        newSymbol.group = CP;
                        newSymbol.attach(symbol1);
                        newSymbol.attach(symbol2);
                        symbol1 = newSymbol;
                    }
                }
                else { 
                    //the way to deal with both N and S is identical when the power is equal to 1
                    //if the CP contains a power of 1 then we can just add directly to it
                    if(symbol2.power === 1) { 
                        //CP symbols can have a multiplier greater than 1 
                        if(symbol2.multiplier === 1) {
                            symbol2.attach(symbol1); 
                        }
                        else {
                            //force the multiplier downhill
                            for(var s in symbol2.symbols) {
                                symbol2.symbols[s].multiplier *= symbol2.multiplier;
                            }
                            symbol2.multiplier = 1;
                            symbol2.attach(symbol1);
                        }   
                        //swap since symbol a is being returned
                        symbol1 = symbol2;
                    }
                    else {
                        symbol1.convert(CP);
                        symbol1.attach(symbol2);
                    }
                    
                }
            }
            else { 
                symbol1.convert(CP); 
                symbol1.attach(symbol2);
            }        
            
            //reduce the symbol
            if((symbol1.group === CP || symbol1.group === PL) && symbol1.length === 1) { 
                for(var x in symbol1.symbols) {
                    var symbol = symbol1.symbols[x];
                    symbol.multiplier *= symbol1.multiplier;
                    symbol1 = symbol;
                }
            }

            return symbol1;
        };

        this.subtract = function( symbol1, symbol2) { 
            return this.add(symbol1, symbol2.negate());
        };

        this.multiply = function(symbol1, symbol2) { 
            if(symbol1.multiplier === 0 || symbol2.multiplier === 0) return new Symbol(0);
            var group1 = symbol1.group,
                group2 = symbol2.group,
                reInvert = false;

            //parens is a function that we want to get rid of as soon as possible so check
            if(group1 === FN && symbol1.baseName === PARENTHESIS) symbol1 = this.unpack(symbol1);
            if(group2 === FN && symbol1.baseName === PARENTHESIS) symbol2 = this.unpack(symbol2);
            
            if(symbol1.isImgSymbol && symbol2.isImgSymbol) {
                var sign = (symbol1.power + symbol2.power) === 0 ? 1 : -1; //i/i = 0
                return new Symbol(sign*symbol1.multiplier*symbol2.multiplier);
            }

            //as with addition the lower group symbol is kept on the left so only one side has to symbol2 e 
            //accounted for. With multiplication however it's easier to return the symbol on the right.
            if(group1 > group2) return this.multiply(symbol2, symbol1);
            if(Settings.SAFE){ symbol1 = symbol1.copy(); symbol2 = symbol2.copy(); }
            
            //we want symbol to have a consistent has for example we want (1/x)*(1/y) to have the same hash
            //as 1/(x*y). To ensure this all symbols are kept negative during multiplacation
            if(isNegative(symbol1.power) && isNegative(symbol2.power)) {
                reInvert = true;
                symbol1.invert();
                symbol2.invert();
            }

            //the symbol2 ehavior is the same for all symbols of group N. modify the multiplier
            if(group1 === N ) {
                symbol2.multiplier *= symbol1.multiplier;
            }
            else if(symbol1.value === symbol2.value) {
                if(group1 === S && group2 === EX) { 
                    if(symbol2.previousGroup === PL) {
                        symbol2.convert(CB);
                        symbol2.combine(symbol1);
                    }
                    else {
                        symbol2.power = _.add(symbol2.power, Symbol(symbol1.power));
                    }
                }
                else if(group1 === EX) {
                    if(group2 === PL) { 
                        symbol2.convert(CB);
                        symbol2.combine(symbol1);
                    }
                    else {
                        //both are EX so we're concerned with their previous groups
                        var pg1 = symbol1.previousGroup, pg2 = symbol2.previousGroup;
                        if((pg1 === S || pg1 === N || pg1 === FN)) {
                            var p1 = symbol1.power, p2 = symbol2.power;
                            if(symbol2.group !== EX) {
                                p2 = new Symbol(p2);
                                symbol2 = symbol1;
                            }
                            symbol2.power = _.add(p1, p2);
                        }
                        else if(pg1 === PL && pg1 === pg2) { 
                            if(symbol1.keyForGroup(CB) !== symbol2.keyForGroup(CB)) {
                                symbol2.convert(CB);
                                symbol2.combine(symbol1);
                            }
                            else { 
                                symbol2.power = _.add(symbol2.power, symbol1.power);
                            }
                        }
                        else if(group2 === EX) {
                            symbol2.power = _.add(symbol1.power, symbol2.power);
                        }
                        else {
                            var p = new Symbol(symbol2.power);
                            symbol1.power = _.add(symbol1.power, p);
                            symbol2 = symbol1;
                        }
                    }
                }
                else if(group2 === PL) { 
                    symbol2.distributeMultiplier();
                    if(group1 !== PL) { 
                        if(symbol2.power === 1) {
                            var cp = symbol2.copy();
                            cp.symbols = {};
                            cp.length = 0;
                            for(var s in symbol2.symbols) { 
                                var symbol = remove(symbol2.symbols, s);
                                //keep symbol1 on the left since that's what gets returned
                                var product = _.multiply(symbol1, symbol);
                                //the symbol may no longer be a valid PL e.g (x^2+x)/x yields a CP
                                if(product.value !== cp.value) cp.group = CP;
                                cp.attach(product);
                            }
                            symbol2 = cp;
                        }
                        else {
                            symbol2.convert(CB);
                            symbol2.combine(symbol1);
                        }   
                    }  
                    else { 
                        if(symbol1.value === symbol2.value) {
                            symbol2.power += symbol1.power;
                        }
                        else {
                            symbol2.convert(CB);
                            symbol2.combine(symbol1);
                        }
                    }
                }
                else {
                    
                    symbol2.power += symbol1.power;
                }
                symbol2.multiplier *= symbol1.multiplier;
                //early exit
                if(Number(symbol2.power) === 0) symbol2 = Symbol(symbol2.multiplier);
                
            }
            else if(group1 === CB && group2 === CB) { 
                symbol1.distributeExponent();
                symbol2.distributeExponent();
                
                //need cleaning. most redundant code
                if(symbol1.power === 1 && symbol2.power !== 1) { var t = symbol1; symbol1 = symbol2 ; symbol2 = t; }
                
                if(symbol1.power === 1 && symbol2.power === 1) {
                    symbol2.multiplier *= symbol1.multiplier;
                    for(var s in symbol1.symbols) {
                        symbol2.combine(symbol1.symbols[s]);
                    }
                }
                else if(symbol2.power === 1){
                    symbol2.attach(symbol1);
                }
                else {
                    var s = new Symbol('x');
                    s.symbols = {};
                    s.group = CB;
                    s.combine(symbol1);
                    s.combine(symbol2);
                    symbol2 = s;
                }  
            }
            else if(group2 === CB) {
                symbol2.distributeExponent();
                symbol2.combine(symbol1);
            }
            else if(group1 === S && group2 !== CB) {
                symbol1.convert(CB);
                symbol1.combine(symbol2);
                symbol2 = symbol1;
            }
            else { 
                if(group1 === CB) {
                    symbol1.combine(symbol2);
                    symbol2 = symbol1;
                }
                else {
                    symbol2.convert(CB);
                    symbol2.combine(symbol1);
                }   
            }
            if((symbol2.group === CB) && symbol2.length === 1) { 
                for(var x in symbol2.symbols) {
                    var symbol = symbol2.symbols[x];
                    symbol.multiplier *= symbol2.multiplier;
                    symbol2 = symbol;
                }
            }
            
            if(reInvert) symbol2.invert();

            return symbol2 ;
        };
        
        this.divide = function(symbol1, symbol2) {
            if(symbol2.multiplier === 0) error('Division by zero!');
            return this.multiply(symbol1, symbol2.invert());
        };

        this.pow = function(symbol1,symbol2) {
            var numberB = Number(symbol2);
            if(numberB === 1) return symbol1;
            if(numberB === 0) return new Symbol(1);

            //as usual pull the variables closer
            var group1 = symbol1.group, 
                group2 = symbol2.group;
            
            if(Settings.SAFE){ symbol1 = symbol1.copy(); symbol2 = symbol2.copy(); };
            
            if(group1 !== EX && group2 === N) { 
                var power = symbol2.multiplier;
                if(power !== 1) {
                    if(power === 0) {
                        symbol2.mutiplier = 1;
                        symbol1 = symbol2;
                    }
                    else { 
                        //check if the power that we're raising to is even e.g. 2,4,1/2,1/4,5/2,...
                        var isEven = even(power),
                            // Record if we have a negative number as the base.
                            isNegative = symbol1.multiplier < 0,
                            // Make sure that the power is even.
                            powEven =  even(symbol1.power),
                            //check if the power being raised to is a fraction
                            isRadical = Math.abs(power % 1) > 0;
                            
                        if(group1 === N) {
                            var isImaginary = isNegative && isRadical;
                            if(isImaginary) symbol1.multiplier *= -1;
                            symbol1.multiplier = Math.pow(symbol1.multiplier, power);
                            if(isImaginary) {
                                symbol1 = this.multiply(symbol1, new Symbol('i'));
                                if(power < 0) symbol1.negate();
                            }
                        }
                        else { 
                            var sm = symbol1.multiplier,
                                s = Math.pow(Math.abs(sm), power),
                                sign = Math.abs(sm)/sm;
                            symbol1.power *= power;
                            symbol1.multiplier = s;
                            
                            if(isNegative && !isEven) symbol1.multiplier *= sign;
                            
                            if(isRadical && isNegative) { 
                                var m = -symbol1.multiplier;
                                if(powEven) {
                                    symbol1.multiplier = 1;
                                    if(!even(symbol1.power)) {
                                        symbol1 = this.symfunction(ABS, [symbol1]);
                                    }
                                    symbol1 = this.multiply(new Symbol('i'), symbol1);
                                }
                                else {
                                    var p = symbol1.power;
                                    symbol1.multiplier /= m;
                                    symbol1.power /= p;
                                    symbol1 = this.symfunction(PARENTHESIS, [symbol1]);
                                    symbol1.power = p;
                                }
                                symbol1.multiplier = m;
                            }
                            if(powEven && isRadical && !even(symbol1.power)) {
                                //we have to wrap the symbol in the abs function to preserve the absolute value
                                var p = symbol1.power; //save the power
                                symbol1.power = 1;
                                symbol1 = _.symfunction(ABS,[symbol1]);
                                symbol1.power = p;
                            }
                            
                            //Attempt to unwrap abs
                            if(symbol1.group === FN && symbol1.baseName === ABS) {
                                var s = symbol1.args[0];
                                var ppower = symbol1.power * s.power;
                                if(even(ppower)) {
                                    s.power = ppower;
                                    s.multiplier = symbol1.multiplier * Math.pow(s.multiplier, symbol1.power);
                                    symbol1 = s;
                                }
                            }
                        }
                    }
                }
                //distribute the power for the CB class
                if(group1 === CB) { 
                    var p = symbol1.power;
                    for(var x in symbol1.symbols) { symbol1.symbols[x].power *= p; }
                    symbol1.power = 1;
                }
            }
            else { 
                var m, spow = symbol1.power;
                //symbol power may be undefined if symbol is of type N
                if(!isSymbol(spow)) spow = new Symbol(spow || 1);

                if(Math.abs(symbol1.multiplier) !== 1) {
                    m = new Symbol(symbol1.multiplier);
                    m.convert(EX);
                    m.power = symbol2.copy();
                    symbol1.multiplier = 1;
                }
                
                if(symbol1.group !== EX) symbol1.convert(EX);

                symbol1.power = this.multiply(spow, symbol2);
                //reduce symbol to simpler form. 
                if(symbol1.power.isOne()) {
                    symbol1.group = symbol1.previousGroup;
                    delete symbol1.previousGroup;
                    symbol1.power = 1;
                }

                if(m) { symbol1 = this.multiply(symbol1, m); }
            }

            return symbol1;
        };
        
        this.comma = function(a, b) { 
            if(a instanceof Array) a.push(b);
            else a = [a,b];
            return a;
        };
    };
    
    /* "STATIC" */
    var Fraction = {
        convert: function( value, opts ) {
            var frac;
            if( value === 0 ) {
                frac = [ 0, 1];
            }
            else {
                if( value < 1e-6 || value > 1e20) {
                    var qc = this.quickConversion( Number( value ) );
                    if( qc[1] <= 1e20 ) {
                        var abs = Math.abs( value );
                        var sign = value/abs;
                        frac = this.fullConversion( abs.toFixed( (qc[1]+'').length-1 ));
                        frac[0] = frac[0]*sign;
                    }
                    else {
                        frac = qc;
                    }
                }
                else {
                    frac = this.fullConversion( value );
                }
            }
            return frac;
        },
        // If the fraction is small or too large this gets called instead of 
        // fullConversion method
        quickConversion: function( dec ) {
            var x = (dec.toExponential()+'').split('e');
            var d = x[0].split('.')[1];// get the number of places after the decimal
            var l = d ? d.length : 0; // maybe the coefficient is an integer;
            return [Math.pow(10,l)*x[0], Math.pow(10, Math.abs(x[1])+l)];
        },
        
        fullConversion: function( dec ) {
            //function returns a good approximation of a fraction
            //http://mathforum.org/library/drmath/view/61772.html
            //Decimal To Fraction Conversion - A Simpler Version
            //Dr Peterson
            var done = false;
            //you can adjust the epsilon to a larger number if you don't need very high precision
            var n1 = 0, d1 = 1, n2 = 1, d2 = 0, n = 0, q = dec, epsilon = 1e-13;
            while(!done) {
                n++;
                if( n > 10000 ){
                    done = true;
                }
                var a = parseInt(q);
                var num = n1 + a * n2;
                var den = d1 + a * d2;
                var e = (q - a);
                if( e < epsilon) {
                    done = true;
                }
                q = 1/e;
                n1 = n2; d1 = d2; n2 = num; d2 = den;
                if(Math.abs(num/den-dec) < epsilon || n > 30) {
                    done = true;
                }
            }
            return [num, den];
        }
    };

    //Depends on Fraction
    var Latex = {
        space: '~',
        latex: function(obj, abs, group, addParens) {
            abs = abs || false;
            group = group || obj.group; 

            var output = '',
                inBraces = this.inBraces, 
                value;
            if(isSymbol(obj)) { 
                switch(group) {
                    case N:
                        value = obj.multiplier;
                        
                        if(abs) value = Math.abs(value);

                        if(isInt(value)) {
                            output = value;
                        }
                        else if(Math.abs(value) === Infinity) {
                            output = '\\infty';
                            if(value === -Infinity) output = '-'+output;
                        }
                        else {
                            var result = Fraction.convert(value);
                            output = this.fraction(result);
                        }  
                        break;
                    case S:
                        output = this.renderSymbolLatex(obj, undefined, abs);
                        break;
                    case FN: 
                        var name = obj.baseName;
                        if(name === PARENTHESIS) name = '';
                        else if(name in Math || name in Math2) name = '\\'+name;

                        var fnInput = obj.args.slice(0).map(function(item) {
                            return Latex.latex(item);
                        });
                        if(name === '\\abs') {
                            value = '\\left|'+fnInput+'\\right|';
                        }
                        else {
                            value = name+this.inBrackets(fnInput);
                        }
                        
                        output = this.renderSymbolLatex(obj, value, abs);
                        
                        break;
                    case PL:
                        var value = this.renderSubSymbolsLatex(obj, function(a,b) {
                            return a.power < b.power;
                        }, undefined, abs);

                        output = this.renderSymbolLatex(obj, value, abs, obj.group === EX);
                        break;
                    case CP:
                        value = this.renderSubSymbolsLatex(obj, function(a,b) {
                            return a.group < b.group;
                        }, undefined, abs);

                        output = this.renderSymbolLatex(obj, value, abs, obj.group === EX);
                        break;
                    case CB:
                        value = this.renderSubSymbolsLatex(obj, function(a,b) {
                            return a.group < b.group;
                        }, true, abs);

                        output = this.renderSymbolLatex(obj,value, abs);
                        break;
                    case EX:
                        var pg = obj.previousGroup;
                        if(pg === N) {
                            //:) lie about the previous group and render it as a symbol
                            pg = S;
                        }
                        output = this.latex(obj, abs, pg);

                        break;
                }
            }
            else if(isArray(obj)) {
                var l = obj.length;
                for(var i=0; i<l; i++) {
                    output = '\\left['+obj.map(function(a) { return Latex.latex(a); }).join(' ,')+'\\right]';
                }
            }
            else if(typeof obj.latex === 'function') {
                output = obj.latex();
            }
            else {
                output = obj;
            }

            if(addParens) output = this.inBrackets(output);
            
            return output;
        },
        //renders the sub-symbols in complex symbols
        renderSubSymbolsLatex: function(symbol, sortFunction, suppressPlus, abs) { 
            var subSymbols = symbol.collectSymbols().sort(sortFunction),
                l = subSymbols.length, 
                denom = [], i,
                self = this,
                g = symbol.group,
                sqrt = Math.abs(symbol.power) === 0.5;

            for(i=0; i<l; i++) {
                var s = subSymbols[i];
                if(s.isInverse() && g === CB) {
                    denom.push(remove(subSymbols, i).copy().invert());
                    i--, l--; //adjust the index and the length since we're one item shorter
                }
            }
            if(sortFunction) {
                subSymbols.sort(sortFunction);
                denom.sort(sortFunction);
            }
            
            function convert(arr) { 
                var i, l = arr.length, rendered = '';
                for(var i=0; i<l; i++) {
                    var curSymbol = arr[i], delimiter;

                    if(curSymbol.multiplier < 0) {
                        delimiter = '-';
                    }
                    else if(suppressPlus){
                        delimiter = '';
                    }
                    else {
                        delimiter = '+';
                    }
                    //leave the negative for the first symbol
                    abs = abs || i > 0;
                    //TODO: redundant brackets in denominator when denominator is CP or PL
                    var latex = self.latex(curSymbol, abs, undefined, 
                        symbol.group === CB && (curSymbol.group === PL || curSymbol.group === CP));
                        
                    //only add the delimiter to the first one
                    if(i > 0) latex = delimiter+latex;
                    //add it to the total rendered

                    rendered += latex;
                }
                
                return rendered;
            }
            var num = convert(subSymbols),
                denom = convert(denom); 
            if(g === CP || g === PL) {
                if(num && !denom && Math.abs(symbol.multiplier) !== 1 || Math.abs(symbol.power !== 1)) {
                    if(!sqrt) num = Latex.inBrackets(num);
                }
            }

            if(denom && !num) num = 1;
            if(denom) return format('\\frac{{0}}{{1}}', num, denom);
            else return num;
        },
        //renders the style for the multiplier and power of the symbol.
        renderSymbolLatex: function(symbol, value, abs, bracketed) { 
            if(symbol.group === N) return this.latex(symbol, abs);
            value = value || symbol.value;
            
            var multiplierArray = Fraction.convert(symbol.multiplier),
                power = symbol.power || '',
                sign = symbol.multiplier < 0 ? '-' : '',//store the sign
                sqrt = (power) === 0.5,
                sqrtDenom = power === -0.5;
            
            //if the latex was requested as absolute value remove the sign
            if(abs) sign = '';
            
            //make the multiplier array positive
            multiplierArray[0] = Math.abs(multiplierArray[0]);
            
            //handle powers
            if(isSymbol(power)) {
                power = this.latex(power, true);
            }
            else {
                if(Math.abs(power) === 1 || sqrt || sqrtDenom) { 
                    power = '';
                }
                else {
                    var powerArray = Fraction.convert(power);
                    if(powerArray[1] === 1) powerArray.pop();
                    
                    if(symbol.power < 0) {
                        powerArray[0] = Math.abs(powerArray[0]);
                    }
                    power = this.fraction(powerArray);
                }
            }

            //remove the one from the base of the fraction
            if(multiplierArray[1] === 1) multiplierArray.pop();
            
            //if there's a power, the location where we attach it depends on the sign of the power.
            //if negative it's bottom, otherwise we attach it to the top.
            var where  = isNegative(symbol.power) ? 1 : 0;
                
            if(multiplierArray[where] === 1) {
                multiplierArray[where] = value;
            }
            else {
                //sub out the multipliers to the top and bottom
                if(/^\\frac/.test(value)) {
                    var start = 4;
                    for(var i=0; i<2; i++) {
                        var m0 = multiplierArray[i],
                            m = !(m0 === 1 || m0 === undefined) ? m0+this.space : '';
                        var match = betweenBrackets('{', '}', value, start);
                        multiplierArray[i] = m+match[0];
                        start = match[2]+1;
                    }
                }
                else {
                    var curValue = multiplierArray[where] ? multiplierArray[where]+this.space : '';
                    if(sqrtDenom) value = '\\sqrt'+this.inBraces(value);
                    multiplierArray[where] = curValue+value;
                }
            }
            
            if(power) { 
                multiplierArray[where] = this[bracketed ? 'inBrackets': 'inBraces'](multiplierArray[where]);
                if(!sqrt) {
                    multiplierArray[where] += '^'+this.inBraces(power);
                }
            }

            //write the value into a fraction
            value = this.fraction(multiplierArray);
            var retval = sign+value;
            
            if(sqrt) retval = '\\sqrt'+this.inBraces(retval);
            
            return retval;
        },

        fraction: function(fractionArray) {
            if(fractionArray.length === 1) return fractionArray[0];
            return '\\frac'+this.inBraces(fractionArray[0])+this.inBraces(fractionArray[1]);
        },
        inBraces: function(contents, index) {
            index = index === undefined ? '' : '$'+index;
            return '{'+contents+index+'}';
        },
        inBrackets: function(contents) {
            return '\\left('+contents+'\\right)';
        },
        write2Fraction: function(fraction, top, bottom) {
            return fraction.replace('$1', top).replace('$2', bottom);
        }
    };
    
    function Vector(v) {
        if(isVector(v)) this.elements = v.items.slice(0);
        else this.elements = v || [];
    }
    Vector.prototype.custom = true;
    /* END CLASSES */

    /* FINALIZE */
    var finalize = function() {
        reserveNames(_.constants);
        reserveNames(_.functions);
    };
    
    var build = Utils.build = function(symbol, arg_array) {
        var args = variables(symbol);
        var ftext = function(symbol, xports) { 
            xports = xports || [];
            var c = [],
                group = symbol.group,
                prefix = '';

            var ftext_complex = function(group) {
                var d = group === CB ? '*' : '+',
                    cc = [];
                for(var x in symbol.symbols) cc.push(ftext(symbol.symbols[x], xports)[0]);
                var retval = cc.join(d);
                return retval ? inBrackets(retval) : retval;
            },

            ftext_function = function(bn) {
                var retval;
                if(bn in Math) retval = 'Math.'+bn;
                else {
                    //Math2 functions aren't part of the standard javascript
                    //Math library and must be exported.
                    xports.push('var '+bn+' = '+_.Math2[bn].toString()+'; ');
                    retval = bn;
                }
                retval = retval+inBrackets(symbol.args.map(function(x) {
                    return ftext(x, xports)[0];
                }).join(','));
                return retval;
            };

            //the multiplier
            if(group === N) c.push(symbol.multiplier);
            else if(symbol.multiplier === -1) prefix = '-';
            else if(symbol.multiplier !== 1) c.push(symbol.multiplier);
            //the value
            var value = null;

            if(group === S) value = symbol.value;
            else if(group === FN) { 
                value = ftext_function(symbol.baseName);
            }
            else if(group === EX) {
                var pg = symbol.previousGroup;
                if(pg === N || pg === S) value = symbol.value;
                else if(pg === FN) value = ftext_function(symbol.baseName);
                else value = ftext_complex(symbol.previousGroup);
            }
            else {
                value = ftext_complex(symbol.group);
            }     

            if(symbol.power !== undefined && symbol.power !== 1) {
                value = 'Math.pow'+inBrackets(value+','+text(symbol.power));
            }

            if(value) c.push(prefix+value);

            return [c.join('*'), xports.join('').replace(/\n+\s+/g, ' ')];
        };
        if(arg_array) {
            if(args.length !== arg_array.length) error('Argument array contains wrong number of arguments');
            for(var i=0; i<args.length; i++) {
                var arg = args[i];
                if(arg_array.indexOf(arg) === -1) error(arg+' not found in argument array');
            }
            args = arg_array;
        }
        var f_array = ftext(symbol);
        return new Function(args, f_array[1]+' return '+f_array[0]+';');
    };
    
    finalize(); //final preparations
    /* END FINALIZE */

    /* BUILD CORE */
    var Core = {};
    Core.groups = Groups;
    Core.Symbol = Symbol;
    Core.Expression = Expression;
    Core.Vector = Vector;
    Core.Parser = Parser;
    Core.Fraction = Fraction;
    Core.Math2 = Math2;
    Core.Latex = Latex;
    Core.Utils = Utils;
    Core.PARSER = _;
    Core.PARENTHESIS = PARENTHESIS;
    Core.Settings = Settings;
    Core.VARS = VARS;
    /* END BUILD CORE */
    
    /* EXPORTS */
    /**
     * 
     * @param {String} expression the expression to be evaluated
     * @param {Object} subs the object containing the variable values
     * @param {Integer} location a specific location in the equation list to 
     * insert the evaluated expression
     * @param {String} option additional options
     * @returns {Expression} 
     */
    
    var libExports = function(expression, subs, option, location) {
        //convert any expression passed in to a string
        if(expression instanceof Expression) expression = expression.toString();
        
        var multi_options = isArray(option),
            expand = 'expand',
            numer = multi_options ? option.indexOf('numer') !== -1 : option === 'numer';
        if((multi_options ? option.indexOf(expand) !== -1 : option === expand) 
                && typeof Core.Algebra.expand !== 'undefined') {
            expression = format('{0}({1})', expand, expression);
        }
        var eq = block('PARSE2NUMBER', function(){
            return _.parse(expression, format_subs(subs));
        }, numer || Settings.PARSE2NUMBER);
        
        if(location) { EQNS[location-1] = eq; }
        else { EQNS.push(eq);}

        return new Expression(eq);
    };
    
    /**
     * 
     * @returns {String} returns the version of nerdamer
     */
    libExports.version = function() {
        return version;
    };
    
    /**
     * 
     * @param {String} constant the name of the constant to be set
     * @param {mixed} value The value of the constant 
     * @returns {Object} Returns the nerdamer object
     */
    libExports.setConstant = function(constant, value) {
        validateName(constant); 
        if(!isReserved(constant)) {
            if(value === 'delete') {
                delete _.constants[constant];
            }
            else {
                if(isNaN(value)) error('Constant must be a number!');
                _.constants[constant] =  value;
            }
        }    
        return this;
    };
    
    /**
     * 
     * @param {String} name the name of the function
     * @param {Array} params_array a list containing the parameter name of the functions
     * @param {String} body the body of the function
     * @returns {Boolean} returns true if succeeded and falls on fail
     * @example nerdamer.setFunction('f',['x'], 'x^2+2');
     */
    libExports.setFunction = function(name, params_array, body) {
        validateName(name);
        if(!isReserved(name)) {
            params_array = params_array || variables(_.parse(body));
            _.functions[name] = [_.mapped_function, params_array.length, {
                    name: name,
                    params: params_array,
                    body: body
            }];
            return true;
        }
        return false;
    };
    
    /**
     * 
     * @returns {Core} Exports the nerdamer core functions and objects
     */
    libExports.getCore = function() {
        return Core;
    };

    libExports.getExpression = libExports.getEquation = Expression.getExpression;
    
    /**
     * 
     * @param {Boolean} asArray The returned names are return as an array if this is set to true;
     * @returns {String|Array}
     */
    libExports.reserved = function(asArray) {
        if(asArray){ return RESERVED; }
        return RESERVED.join(', ');
    };
    
    /**
     * 
     * @param {Integer} equation_number the number of the equation to clear. 
     * If 'all' is supplied then all equations are cleared
     * @param {Boolean} keep_EQNS_fixed use true if you don't want to keep EQNS length fixed
     * @returns {Object} Returns the nerdamer object
     */
    libExports.clear = function( equation_number, keep_EQNS_fixed ) { 
        if(equation_number === 'all') { EQNS = []; }
        else if(equation_number === 'last') { EQNS.pop(); }
        else if(equation_number === 'first') { EQNS.shift(); }
        else { 
            var index = !equation_number ? EQNS.length : equation_number-1; 
            keep_EQNS_fixed === true ? EQNS[index] = undefined : remove(EQNS, index);
        }   
        return this;
    };
    
    /**
     * 
     * @param {Boolean} asObject
     * @param {Boolean} asLatex
     * @returns {Array}
     */
    libExports.expressions = libExports.equations = function( asObject, asLatex ) {
        var result = asObject ? {} : [];
        for(var i=0; i<EQNS.length; i++) {
            var eq = asLatex ? Latex.latex(EQNS[i]) : text(EQNS[i]);
            asObject ? result[i+1] = eq : result.push(eq);
        }
        return result;
    };
    
    //the method for registering modules
    libExports.register = function(obj) { 
        var core = this.getCore();
        
        if(isArray(obj)) {
            for(var i=0; i<obj.length; i++) {
                if(obj) this.register(obj[i]);
            }
        }
        else if(obj) {
            //if no parent object is provided then the function does not have an address and cannot be called directly
            var parent_obj = obj.parent, 
                fn = obj.build.call(core); //call constructor to get function
            if(parent_obj) {
                if(!core[parent_obj]) core[obj.parent] = {};
                //attach the function to the core
                core[parent_obj][obj.name] = fn;
            }
            if(obj.visible) _.functions[obj.name] = [fn, obj.numargs]; //make the function available
        } 
    };
    
    /**
     * @param {String} name variable name
     * @returns {boolean} validates if the profided string is a valid variable name
     */
    libExports.validateName = validateName;
    
    /**
     * 
     * @returns {Array} Array of functions currently supported by nerdamer
     */
    libExports.supported = function() {
        return keys(_.functions);
    };
    
    /**
     * 
     * @returns {Number} The number equations/expressions currently loaded
     */
    libExports.numEquations = libExports.numExpressions = function() {
        return EQNS.length;
    };
    /* END EXPORTS */
    
    /**
     * 
     * @param {String} v variable to be set
     * @param {String} val value of variable. This can be a variable expression or number
     * @returns {Object} Returns the nerdamer object
     */
    libExports.setVar = function(v, val) {
        validateName(v);
        if(val === 'delete') delete VARS[v];
        else VARS[v] = _.parse(val);
        return this;
    };
    
    /**
     * 
     * @param {String} setting The setting to be changed
     * @param {boolean} value 
     */
    libExports.set = function(setting, value) {
        var disallowed = ['SAFE'];
        if(disallowed.indexOf(setting) !== -1) error('Cannot modify setting: '+setting);
        Settings[setting] = value;
    };
    
    return libExports; //Done
})();

/*
* Author : Martin Donk
* Website : http://www.nerdamer.com
* Email : martin.r.donk@gmail.com
* License : http://opensource.org/licenses/LGPL-3.0
* Source : https://github.com/jiggzson/nerdamer
*/

(function() {
    var core = nerdamer.getCore(),
        _ = core.PARSER,
        keys = core.Utils.keys,
        text = core.Utils.text,
        remove = core.Utils.remove,
        Symbol = core.Symbol,
        S = core.groups.S,
        round = core.Utils.round,
        isInt = core.Utils.isInt,
        Math2 = core.Math2,
        variables = core.Utils.variables,
        isComposite = core.Utils.isComposite,
        isSymbol = core.Utils.isSymbol,
        PL = core.groups.PL,
        CP = core.groups.CP;
    
    var __ = core.Algebra = {
        /*
        * proots is Mr. David Binner's javascript port of the Jenkins-Traub algorithm.
        * The original source code can be found here http://www.akiti.ca/PolyRootRe.html.
        */  
        proots: function(symbol, decp) { 
            //the roots will be rounded up to 7 decimal places.
            //if this causes trouble you can explicitly pass in a different number of places
            decp = decp || 7;
            var zeros = 0;
            if(symbol instanceof Symbol && symbol.isPoly()) { 
                if(symbol.group === core.groups.S) {
                    return [0];
                }
                else if(symbol.group === core.groups.PL) { 
                    var powers = keys(symbol.symbols),
                        minpower = core.Utils.arrayMin(powers),
                        factor = core.PARSER.parse(symbol.value+'^'+minpower);
                    zeros = minpower;
                    symbol = core.PARSER.divide(symbol, core.PARSER.parse(symbol.value+'^'+minpower));
                }

                var roots = calcroots();
                for(var i=0;i<zeros;i++) roots.unshift(0);

                return roots;
            }
            else {
                throw new Error('Cannot calculate roots. Symbol must be a polynomial!')
            }

            function calcroots(){	
                var MAXDEGREE = 100, // Degree of largest polynomial accepted by this script.
                    variable = keys( symbol.symbols ).sort().pop(), 
                    sym = symbol.group === core.groups.PL ? symbol.symbols : symbol.symbols[variable], 
                    g = sym.group,
                    powers = g === S ? [sym.power] : keys( sym.symbols ),
                    rarr = [],
                    max = core.Utils.arrayMax(powers); //maximum power and degree of polynomial to be solved
                // Prepare the data
                for(var i=1; i<=max; i++) { 
                    var c = 0; //if there is no power then the hole must be filled with a zero
                    if(powers.indexOf(i+'') !== -1) { 
                        if(g === S) { 
                            c = sym.multiplier; 
                        }
                        else {
                            c = sym.symbols[i].multiplier;
                        }
                    }
                    // Insert the coeffient but from the front
                    rarr.unshift(c);
                }

                rarr.push(symbol.symbols['#'].multiplier);

                // Make a copy of the coefficients before appending the max power
                var p = rarr.slice(0);

                // Divide the string up into its individual entries, which--presumably--are separated by whitespace
                rarr.unshift(max);


                if (max > MAXDEGREE){
                    throw new Error("This utility accepts polynomials of degree up to " + MAXDEGREE + ". ");
                }

                var zeroi = [],   // Vector of imaginary components of roots
                    degreePar = {};    // degreePar is a dummy variable for passing the parameter POLYDEGREE by reference
                degreePar.Degree = max; 

                for (i = 0; i < max; i++) {
                    zeroi.push(0);
                }
                var zeror = zeroi.slice(0); // Vector of real components of roots

                // Find the roots
                //--> Begin Jenkins-Traub

                /*
                 * A verbatim copy of Mr. David Binner's Jenkins-Traub port
                */
               function QuadSD_ak1(NN, u, v, p, q, iPar){
                   // Divides p by the quadratic 1, u, v placing the quotient in q and the remainder in a, b
                   // iPar is a dummy variable for passing in the two parameters--a and b--by reference
                   q[0] = iPar.b = p[0];
                   q[1] = iPar.a = -(u*iPar.b) + p[1];

                   for (var i = 2; i < NN; i++){
                       q[i] = -(u*iPar.a + v*iPar.b) + p[i];
                       iPar.b = iPar.a;
                       iPar.a = q[i];
                   } 
                   return;
               } 

               function calcSC_ak1(DBL_EPSILON, N, a, b, iPar, K, u, v, qk){
                   // This routine calculates scalar quantities used to compute the next K polynomial and
                   // new estimates of the quadratic coefficients.
                   // calcSC -	integer variable set here indicating how the calculations are normalized
                   // to avoid overflow.
                   // iPar is a dummy variable for passing in the nine parameters--a1, a3, a7, c, d, e, f, g, and h --by reference

                   // sdPar is a dummy variable for passing the two parameters--c and d--into QuadSD_ak1 by reference
                   var sdPar = new Object(),    
                   // TYPE = 3 indicates the quadratic is almost a factor of K
                       dumFlag = 3;	

                   // Synthetic division of K by the quadratic 1, u, v
                   sdPar.b =  sdPar.a = 0.0;
                   QuadSD_ak1(N, u, v, K, qk, sdPar);
                   iPar.c = sdPar.a;
                   iPar.d = sdPar.b;

                   if (Math.abs(iPar.c) <= (100.0*DBL_EPSILON*Math.abs(K[N - 1]))) {
                       if (Math.abs(iPar.d) <= (100.0*DBL_EPSILON*Math.abs(K[N - 2])))  return dumFlag;
                   } 

                   iPar.h = v*b;
                   if (Math.abs(iPar.d) >= Math.abs(iPar.c)){
                         // TYPE = 2 indicates that all formulas are divided by d
                       dumFlag = 2;		
                       iPar.e = a/(iPar.d);
                       iPar.f = (iPar.c)/(iPar.d);
                       iPar.g = u*b;
                       iPar.a3 = (iPar.e)*((iPar.g) + a) + (iPar.h)*(b/(iPar.d));
                       iPar.a1 = -a + (iPar.f)*b;
                       iPar.a7 = (iPar.h) + ((iPar.f) + u)*a;
                   } 
                   else {
                       // TYPE = 1 indicates that all formulas are divided by c;
                       dumFlag = 1;		
                       iPar.e = a/(iPar.c);
                       iPar.f = (iPar.d)/(iPar.c);
                       iPar.g = (iPar.e)*u;
                       iPar.a3 = (iPar.e)*a + ((iPar.g) + (iPar.h)/(iPar.c))*b;
                       iPar.a1 = -(a*((iPar.d)/(iPar.c))) + b;
                       iPar.a7 = (iPar.g)*(iPar.d) + (iPar.h)*(iPar.f) + a;
                   } 
                   return dumFlag;
               } 

               function nextK_ak1(DBL_EPSILON, N, tFlag, a, b, iPar, K, qk, qp){
                   // Computes the next K polynomials using the scalars computed in calcSC_ak1
                   // iPar is a dummy variable for passing in three parameters--a1, a3, and a7
                   var temp;
                   if (tFlag == 3){	// Use unscaled form of the recurrence
                       K[1] = K[0] = 0.0;
                       for (var i = 2; i < N; i++)	 { K[i] = qk[i - 2]; }
                       return;
                   } 

                   temp = ((tFlag == 1) ? b : a);
                   if (Math.abs(iPar.a1) > (10.0*DBL_EPSILON*Math.abs(temp))){
                       // Use scaled form of the recurrence
                       iPar.a7 /= iPar.a1;
                       iPar.a3 /= iPar.a1;
                       K[0] = qp[0];
                       K[1] = -(qp[0]*iPar.a7) + qp[1];
                       for (var i = 2; i < N; i++)	 K[i] = -(qp[i - 1]*iPar.a7) + qk[i - 2]*iPar.a3 + qp[i];
                   } 
                   else {
                       // If a1 is nearly zero, then use a special form of the recurrence
                       K[0] = 0.0;
                       K[1] = -(qp[0]*iPar.a7);
                       for (var i = 2; i < N; i++) { K[i] = -(qp[i - 1]*iPar.a7) + qk[i - 2]*iPar.a3; }
                   } 
                   return;
               }

               function newest_ak1(tFlag, iPar, a, a1, a3, a7, b, c, d, f, g, h, u, v, K, N, p){
                   // Compute new estimates of the quadratic coefficients using the scalars computed in calcSC_ak1
                   // iPar is a dummy variable for passing in the two parameters--uu and vv--by reference
                   // iPar.a = uu, iPar.b = vv

                   var a4, a5, b1, b2, c1, c2, c3, c4, temp;
                   iPar.b = iPar.a = 0.0;// The quadratic is zeroed

                   if (tFlag != 3){
                       if (tFlag != 2){
                           a4 = a + u*b + h*f;
                           a5 = c + (u + v*f)*d;
                       } 
                       else { 
                           a4 = (a + g)*f + h;
                           a5 = (f + u)*c + v*d;
                       } 

                       // Evaluate new quadratic coefficients
                       b1 = -(K[N - 1]/p[N]);
                       b2 = -(K[N - 2] + b1*p[N - 1])/p[N];
                       c1 = v*b2*a1;
                       c2 = b1*a7;
                       c3 = b1*b1*a3;
                       c4 = -(c2 + c3) + c1;
                       temp = -c4 + a5 + b1*a4;
                       if (temp != 0.0) {
                           iPar.a = -((u*(c3 + c2) + v*(b1*a1 + b2*a7))/temp) + u;
                           iPar.b = v*(1.0 + c4/temp);
                       } 
                   } 
                   return;
               } 

               function Quad_ak1(a, b1, c, iPar){
                   // Calculates the zeros of the quadratic a*Z^2 + b1*Z + c
                   // The quadratic formula, modified to avoid overflow, is used to find the larger zero if the
                   // zeros are real and both zeros are complex. The smaller real zero is found directly from
                   // the product of the zeros c/a.

                   // iPar is a dummy variable for passing in the four parameters--sr, si, lr, and li--by reference

                   var b, d, e;
                   iPar.sr = iPar.si = iPar.lr = iPar.li = 0.0;

                   if (a == 0) {
                       iPar.sr = ((b1 != 0) ? -(c/b1) : iPar.sr);
                       return;
                   } 
                   if (c == 0){
                       iPar.lr = -(b1/a);
                       return;
                   } 

                   // Compute discriminant avoiding overflow
                   b = b1/2.0;
                   if (Math.abs(b) < Math.abs(c)){
                       e = ((c >= 0) ? a : -a);
                       e = -e + b*(b/Math.abs(c));
                       d = Math.sqrt(Math.abs(e))*Math.sqrt(Math.abs(c));
                   } 
                   else { 
                       e = -((a/b)*(c/b)) + 1.0;
                       d = Math.sqrt(Math.abs(e))*(Math.abs(b));
                   } 

                   if (e >= 0) {
                       // Real zeros
                       d = ((b >= 0) ? -d : d);
                       iPar.lr = (-b + d)/a;
                       iPar.sr = ((iPar.lr != 0) ? (c/(iPar.lr))/a : iPar.sr);
                   }
                   else { 
                       // Complex conjugate zeros
                       iPar.lr = iPar.sr = -(b/a);
                       iPar.si = Math.abs(d/a);
                       iPar.li = -(iPar.si);
                   } 
                   return;
               }  

               function QuadIT_ak1(DBL_EPSILON, N, iPar, uu, vv, qp, NN, sdPar, p, qk, calcPar, K){
                   // Variable-shift K-polynomial iteration for a quadratic factor converges only if the
                   // zeros are equimodular or nearly so.
                   // iPar is a dummy variable for passing in the five parameters--NZ, lzi, lzr, szi, and szr--by reference
                   // sdPar is a dummy variable for passing the two parameters--a and b--in by reference
                   // calcPar is a dummy variable for passing the nine parameters--a1, a3, a7, c, d, e, f, g, and h --in by reference

                   // qPar is a dummy variable for passing the four parameters--szr, szi, lzr, and lzi--into Quad_ak1 by reference
                   var qPar = new Object(),    
                       ee, mp, omp, relstp, t, u, ui, v, vi, zm,
                       i, j = 0, tFlag, triedFlag = 0;   // Integer variables

                   iPar.NZ = 0;// Number of zeros found
                   u = uu; // uu and vv are coefficients of the starting quadratic
                   v = vv;

                   do {
                       qPar.li = qPar.lr =  qPar.si = qPar.sr = 0.0;
                       Quad_ak1(1.0, u, v, qPar);
                       iPar.szr = qPar.sr;
                       iPar.szi = qPar.si;
                       iPar.lzr = qPar.lr;
                       iPar.lzi = qPar.li;

                       // Return if roots of the quadratic are real and not close to multiple or nearly
                       // equal and of opposite sign.
                       if (Math.abs(Math.abs(iPar.szr) - Math.abs(iPar.lzr)) > 0.01*Math.abs(iPar.lzr))  break;

                       // Evaluate polynomial by quadratic synthetic division

                       QuadSD_ak1(NN, u, v, p, qp, sdPar);

                       mp = Math.abs(-((iPar.szr)*(sdPar.b)) + (sdPar.a)) + Math.abs((iPar.szi)*(sdPar.b));

                       // Compute a rigorous bound on the rounding error in evaluating p

                       zm = Math.sqrt(Math.abs(v));
                       ee = 2.0*Math.abs(qp[0]);
                       t = -((iPar.szr)*(sdPar.b));

                       for (i = 1; i < N; i++)  { ee = ee*zm + Math.abs(qp[i]); }

                       ee = ee*zm + Math.abs(t + sdPar.a);
                       ee = (9.0*ee + 2.0*Math.abs(t) - 7.0*(Math.abs((sdPar.a) + t) + zm*Math.abs((sdPar.b))))*DBL_EPSILON;

                       // Iteration has converged sufficiently if the polynomial value is less than 20 times this bound
                       if (mp <= 20.0*ee){
                           iPar.NZ = 2;
                           break;
                       } 

                       j++;
                       // Stop iteration after 20 steps
                       if (j > 20)  break;
                       if (j >= 2){
                           if ((relstp <= 0.01) && (mp >= omp) && (!triedFlag)){
                               // A cluster appears to be stalling the convergence. Five fixed shift
                               // steps are taken with a u, v close to the cluster.
                               relstp = ((relstp < DBL_EPSILON) ? Math.sqrt(DBL_EPSILON) : Math.sqrt(relstp));
                               u -= u*relstp;
                               v += v*relstp;

                               QuadSD_ak1(NN, u, v, p, qp, sdPar);
                               for (i = 0; i < 5; i++){
                                   tFlag = calcSC_ak1(DBL_EPSILON, N, sdPar.a, sdPar.b, calcPar, K, u, v, qk);
                                   nextK_ak1(DBL_EPSILON, N, tFlag, sdPar.a, sdPar.b, calcPar, K, qk, qp);
                               } 

                               triedFlag = 1;
                               j = 0;

                           } 
                       }
                       omp = mp;

                       // Calculate next K polynomial and new u and v
                       tFlag = calcSC_ak1(DBL_EPSILON, N, sdPar.a, sdPar.b, calcPar, K, u, v, qk);
                       nextK_ak1(DBL_EPSILON, N, tFlag, sdPar.a, sdPar.b, calcPar, K, qk, qp);
                       tFlag = calcSC_ak1(DBL_EPSILON, N, sdPar.a, sdPar.b, calcPar, K, u, v, qk);
                       newest_ak1(tFlag, sdPar, sdPar.a, calcPar.a1, calcPar.a3, calcPar.a7, sdPar.b, calcPar.c, calcPar.d, calcPar.f, calcPar.g, calcPar.h, u, v, K, N, p);
                       ui = sdPar.a;
                       vi = sdPar.b;

                       // If vi is zero, the iteration is not converging
                       if (vi != 0){
                           relstp = Math.abs((-v + vi)/vi);
                           u = ui;
                           v = vi;
                       } 
                   } while (vi != 0); 
                   return;
               } 

               function RealIT_ak1(DBL_EPSILON, iPar, sdPar, N, p, NN, qp, K, qk){
                   // Variable-shift H-polynomial iteration for a real zero
                   // sss	- starting iterate = sdPar.a
                   // NZ		- number of zeros found = iPar.NZ
                   // dumFlag	- flag to indicate a pair of zeros near real axis, returned to iFlag

                   var ee, kv, mp, ms, omp, pv, s, t,
                       dumFlag, i, j, nm1 = N - 1;   // Integer variables

                   iPar.NZ = j = dumFlag = 0;
                   s = sdPar.a;

                   for ( ; ; ) {
                       pv = p[0];

                       // Evaluate p at s
                       qp[0] = pv;
                       for (i = 1; i < NN; i++)  { qp[i] = pv = pv*s + p[i]; }
                       mp = Math.abs(pv);

                       // Compute a rigorous bound on the error in evaluating p
                       ms = Math.abs(s);
                       ee = 0.5*Math.abs(qp[0]);
                       for (i = 1; i < NN; i++)  { ee = ee*ms + Math.abs(qp[i]); }

                       // Iteration has converged sufficiently if the polynomial value is less than
                       // 20 times this bound
                       if (mp <= 20.0*DBL_EPSILON*(2.0*ee - mp)){
                           iPar.NZ = 1;
                           iPar.szr = s;
                           iPar.szi = 0.0;
                           break;
                       } 
                       j++;
                       // Stop iteration after 10 steps
                       if (j > 10)  break;

                       if (j >= 2){
                           if ((Math.abs(t) <= 0.001*Math.abs(-t + s)) && (mp > omp)){
                               // A cluster of zeros near the real axis has been encountered.
                               // Return with iFlag set to initiate a quadratic iteration.
                               dumFlag = 1;
                               iPar.a = s;
                               break;
                           } // End if ((fabs(t) <= 0.001*fabs(s - t)) && (mp > omp))
                       } //End if (j >= 2)

                       // Return if the polynomial value has increased significantly
                       omp = mp;

                       // Compute t, the next polynomial and the new iterate
                       qk[0] = kv = K[0];
                       for (i = 1; i < N; i++)	 { qk[i] = kv = kv*s + K[i]; }

                       if (Math.abs(kv) > Math.abs(K[nm1])*10.0*DBL_EPSILON){
                           // Use the scaled form of the recurrence if the value of K at s is non-zero
                           t = -(pv/kv);
                           K[0] = qp[0];
                           for (i = 1; i < N; i++) { K[i] = t*qk[i - 1] + qp[i]; }
                       }
                       else { 
                           // Use unscaled form
                           K[0] = 0.0;
                           for (i = 1; i < N; i++)	 K[i] = qk[i - 1];
                       }

                       kv = K[0];
                       for (i = 1; i < N; i++) { kv = kv*s + K[i]; }
                       t = ((Math.abs(kv) > (Math.abs(K[nm1])*10.0*DBL_EPSILON)) ? -(pv/kv) : 0.0);
                       s += t;
                   } 
                   return dumFlag;
               } 

               function Fxshfr_ak1(DBL_EPSILON, MDP1, L2, sr, v, K, N, p, NN, qp, u, iPar){

                   // Computes up to L2 fixed shift K-polynomials, testing for convergence in the linear or
                   // quadratic case. Initiates one of the variable shift iterations and returns with the
                   // number of zeros found.
                   // L2	limit of fixed shift steps
                   // iPar is a dummy variable for passing in the five parameters--NZ, lzi, lzr, szi, and szr--by reference
                   // NZ	number of zeros found
                   var sdPar = new Object(),    // sdPar is a dummy variable for passing the two parameters--a and b--into QuadSD_ak1 by reference
                       calcPar = new Object(),
                       // calcPar is a dummy variable for passing the nine parameters--a1, a3, a7, c, d, e, f, g, and h --into calcSC_ak1 by reference

                       qk = new Array(MDP1),
                       svk = new Array(MDP1),
                       a, b, betas, betav, oss, ots, otv, ovv, s, ss, ts, tss, tv, tvv, ui, vi, vv,
                       fflag, i, iFlag = 1, j, spass, stry, tFlag, vpass, vtry;     // Integer variables

                   iPar.NZ = 0;
                   betav = betas = 0.25;
                   oss = sr;
                   ovv = v;

                   //Evaluate polynomial by synthetic division
                   sdPar.b =  sdPar.a = 0.0;
                   QuadSD_ak1(NN, u, v, p, qp, sdPar);
                   a = sdPar.a;
                   b = sdPar.b;
                   calcPar.h = calcPar.g = calcPar.f = calcPar.e = calcPar.d = calcPar.c = calcPar.a7 = calcPar.a3 = calcPar.a1 = 0.0;
                   tFlag = calcSC_ak1(DBL_EPSILON, N, a, b, calcPar, K, u, v, qk);

                   for (j = 0; j < L2; j++){
                       fflag = 1;

                       // Calculate next K polynomial and estimate v
                       nextK_ak1(DBL_EPSILON, N, tFlag, a, b, calcPar, K, qk, qp);
                       tFlag = calcSC_ak1(DBL_EPSILON, N, a, b, calcPar, K, u, v, qk);

                       // Use sdPar for passing in uu and vv instead of defining a brand-new variable.
                       // sdPar.a = ui, sdPar.b = vi
                       newest_ak1(tFlag, sdPar, a, calcPar.a1, calcPar.a3, calcPar.a7, b, calcPar.c, calcPar.d, calcPar.f, calcPar.g, calcPar.h, u, v, K, N, p);
                       ui = sdPar.a;
                       vv = vi = sdPar.b;

                       // Estimate s
                       ss = ((K[N - 1] != 0.0) ? -(p[N]/K[N - 1]) : 0.0);
                       ts = tv = 1.0;

                       if ((j != 0) && (tFlag != 3)){
                           // Compute relative measures of convergence of s and v sequences
                           tv = ((vv != 0.0) ? Math.abs((vv - ovv)/vv) : tv);
                           ts = ((ss != 0.0) ? Math.abs((ss - oss)/ss) : ts);

                           // If decreasing, multiply the two most recent convergence measures
                           tvv = ((tv < otv) ? tv*otv : 1.0);
                           tss = ((ts < ots) ? ts*ots : 1.0);

                           // Compare with convergence criteria
                           vpass = ((tvv < betav) ? 1 : 0);
                           spass = ((tss < betas) ? 1 : 0);

                           if ((spass) || (vpass)){

                               // At least one sequence has passed the convergence test.
                               // Store variables before iterating

                               for (i = 0; i < N; i++) { svk[i] = K[i]; }
                               s = ss;

                               // Choose iteration according to the fastest converging sequence

                                 stry = vtry = 0;

                               for ( ; ; ) {
                                   if ((fflag && ((fflag = 0) == 0)) && ((spass) && (!vpass || (tss < tvv)))){
                                       ;// Do nothing. Provides a quick "short circuit".
                                   } 
                                   else { 
                                       QuadIT_ak1(DBL_EPSILON, N, iPar, ui, vi, qp, NN, sdPar, p, qk, calcPar, K);
                                       a = sdPar.a;
                                       b = sdPar.b;

                                       if ((iPar.NZ) > 0) return;

                                       // Quadratic iteration has failed. Flag that it has been tried and decrease the
                                       // convergence criterion
                                       iFlag = vtry = 1;
                                       betav *= 0.25;

                                       // Try linear iteration if it has not been tried and the s sequence is converging
                                       if (stry || (!spass)){
                                           iFlag = 0;
                                       }
                                       else {
                                           for (i = 0; i < N; i++) K[i] = svk[i];
                                       } 
                                   }
                                   //fflag = 0;
                                   if (iFlag != 0){
                                       // Use sdPar for passing in s instead of defining a brand-new variable.
                                       // sdPar.a = s
                                       sdPar.a = s;
                                       iFlag = RealIT_ak1(DBL_EPSILON, iPar, sdPar, N, p, NN, qp, K, qk);
                                       s = sdPar.a;

                                       if ((iPar.NZ) > 0) return;

                                       // Linear iteration has failed. Flag that it has been tried and decrease the
                                       // convergence criterion
                                       stry = 1;
                                       betas *= 0.25;

                                       if (iFlag != 0){
                                           // If linear iteration signals an almost double real zero, attempt quadratic iteration
                                           ui = -(s + s);
                                           vi = s*s;
                                           continue;

                                       } 
                                   } 

                                   // Restore variables
                                   for (i = 0; i < N; i++) K[i] = svk[i];

                                   // Try quadratic iteration if it has not been tried and the v sequence is converging
                                   if (!vpass || vtry) break;		// Break out of infinite for loop

                               } 

                               // Re-compute qp and scalar values to continue the second stage

                               QuadSD_ak1(NN, u, v, p, qp, sdPar);
                               a = sdPar.a;
                               b = sdPar.b;

                               tFlag = calcSC_ak1(DBL_EPSILON, N, a, b, calcPar, K, u, v, qk);
                           } 
                       } 
                       ovv = vv;
                       oss = ss;
                       otv = tv;
                       ots = ts;
                   } 
                   return;
               }  

               function rpSolve(degPar, p, zeror, zeroi){ 
                   var N = degPar.Degree,
                       RADFAC = 3.14159265358979323846/180,  // Degrees-to-radians conversion factor = PI/180
                       LB2 = Math.LN2,// Dummy variable to avoid re-calculating this value in loop below
                       MDP1 = degPar.Degree + 1,
                       K = new Array(MDP1),
                       pt = new Array(MDP1),
                       qp = new Array(MDP1),
                       temp = new Array(MDP1),
                       // qPar is a dummy variable for passing the four parameters--sr, si, lr, and li--by reference
                       qPar = new Object(),
                       // Fxshfr_Par is a dummy variable for passing parameters by reference : NZ, lzi, lzr, szi, szr);
                       Fxshfr_Par = new Object(),
                       bnd, DBL_EPSILON, df, dx, factor, ff, moduli_max, moduli_min, sc, x, xm,
                       aa, bb, cc, sr, t, u, xxx,
                       j, jj, l, NM1, NN, zerok;// Integer variables

                   // Calculate the machine epsilon and store in the variable DBL_EPSILON.
                   // To calculate this value, just use existing variables rather than create new ones that will be used only for this code block
                   aa = 1.0;
                   do {
                       DBL_EPSILON = aa;
                       aa /= 2;
                       bb = 1.0 + aa;
                   } while (bb > 1.0);

                   var LO = Number.MIN_VALUE/DBL_EPSILON,
                       cosr = Math.cos(94.0*RADFAC),// = -0.069756474
                       sinr = Math.sin(94.0*RADFAC),// = 0.99756405
                       xx = Math.sqrt(0.5),// = 0.70710678
                       yy = -xx;

                   Fxshfr_Par.NZ = j = 0;
                   Fxshfr_Par.szr = Fxshfr_Par.szi =  Fxshfr_Par.lzr = Fxshfr_Par.lzi = 0.0;

                   // Remove zeros at the origin, if any
                   while (p[N] == 0){
                       zeror[j] = zeroi[j] = 0;
                       N--;
                       j++;
                   }
                   NN = N + 1;

                   // >>>>> Begin Main Loop <<<<<
                   while (N >= 1){ // Main loop
                       // Start the algorithm for one zero
                       if (N <= 2){
                           // Calculate the final zero or pair of zeros
                           if (N < 2){
                               zeror[degPar.Degree - 1] = -(p[1]/p[0]);
                               zeroi[degPar.Degree - 1] = 0;
                           } 
                           else { 
                               qPar.li = qPar.lr =  qPar.si = qPar.sr = 0.0;
                               Quad_ak1(p[0], p[1], p[2], qPar);
                               zeror[degPar.Degree - 2] = qPar.sr;
                               zeroi[degPar.Degree - 2] = qPar.si;
                               zeror[degPar.Degree - 1] = qPar.lr;
                               zeroi[degPar.Degree - 1] = qPar.li;
                           } 
                             break;
                       } 

                       // Find the largest and smallest moduli of the coefficients
                       moduli_max = 0.0;
                       moduli_min = Number.MAX_VALUE;

                       for (i = 0; i < NN; i++){
                           x = Math.abs(p[i]);
                           if (x > moduli_max) moduli_max = x;
                           if ((x != 0) && (x < moduli_min)) moduli_min = x;
                       }

                       // Scale if there are large or very small coefficients
                       // Computes a scale factor to multiply the coefficients of the polynomial. The scaling
                       // is done to avoid overflow and to avoid undetected underflow interfering with the
                       // convergence criterion.
                       // The factor is a power of the base.
                       sc = LO/moduli_min;

                       if (((sc <= 1.0) && (moduli_max >= 10)) || ((sc > 1.0) && (Number.MAX_VALUE/sc >= moduli_max))){
                           sc = ((sc == 0) ? Number.MIN_VALUE : sc);
                           l = Math.floor(Math.log(sc)/LB2 + 0.5);
                           factor = Math.pow(2.0, l);
                           if (factor != 1.0){
                               for (i = 0; i < NN; i++) p[i] *= factor;
                           } 
                       } 

                       // Compute lower bound on moduli of zeros
                       for (var i = 0; i < NN; i++) pt[i] = Math.abs(p[i]);
                       pt[N] = -(pt[N]);
                       NM1 = N - 1;

                       // Compute upper estimate of bound
                       x = Math.exp((Math.log(-pt[N]) - Math.log(pt[0]))/N);

                       if (pt[NM1] != 0) {
                           // If Newton step at the origin is better, use it
                           xm = -pt[N]/pt[NM1];
                           x = ((xm < x) ? xm : x);
                       } 

                       // Chop the interval (0, x) until ff <= 0
                       xm = x;
                       do {
                           x = xm;
                           xm = 0.1*x;
                           ff = pt[0];
                           for (var i = 1; i < NN; i++) { ff = ff *xm + pt[i]; }
                       } while (ff > 0); // End do-while loop

                       dx = x;
                       // Do Newton iteration until x converges to two decimal places

                       do {
                           df = ff = pt[0];
                           for (var i = 1; i < N; i++){
                               ff = x*ff + pt[i];
                               df = x*df + ff;
                           } // End for i
                           ff = x*ff + pt[N];
                           dx = ff/df;
                           x -= dx;
                       } while (Math.abs(dx/x) > 0.005); // End do-while loop

                       bnd = x;

                       // Compute the derivative as the initial K polynomial and do 5 steps with no shift
                       for (var i = 1; i < N; i++) K[i] = (N - i)*p[i]/N;
                       K[0] = p[0];
                       aa = p[N];
                       bb = p[NM1];
                       zerok = ((K[NM1] == 0) ? 1 : 0);

                       for (jj = 0; jj < 5; jj++) {
                           cc = K[NM1];
                               if (zerok){
                                   // Use unscaled form of recurrence
                                   for (var i = 0; i < NM1; i++){
                                       j = NM1 - i;
                                       K[j] = K[j - 1];
                                   } // End for i
                                   K[0] = 0;
                                   zerok = ((K[NM1] == 0) ? 1 : 0);
                               } 
                               else { 
                                   // Used scaled form of recurrence if value of K at 0 is nonzero
                                   t = -aa/cc;
                                   for (var i = 0; i < NM1; i++){
                                       j = NM1 - i;
                                       K[j] = t*K[j - 1] + p[j];
                                   } // End for i
                                   K[0] = p[0];
                                   zerok = ((Math.abs(K[NM1]) <= Math.abs(bb)*DBL_EPSILON*10.0) ? 1 : 0);
                               } 
                       } 

                       // Save K for restarts with new shifts
                       for (var i = 0; i < N; i++) temp[i] = K[i];

                       // Loop to select the quadratic corresponding to each new shift
                       for (jj = 1; jj <= 20; jj++){

                           // Quadratic corresponds to a double shift to a non-real point and its
                           // complex conjugate. The point has modulus BND and amplitude rotated
                           // by 94 degrees from the previous shift.

                           xxx = -(sinr*yy) + cosr*xx;
                           yy = sinr*xx + cosr*yy;
                           xx = xxx;
                           sr = bnd*xx;
                           u = -(2.0*sr);

                           // Second stage calculation, fixed quadratic
                           Fxshfr_ak1(DBL_EPSILON, MDP1, 20*jj, sr, bnd, K, N, p, NN, qp, u, Fxshfr_Par);

                           if (Fxshfr_Par.NZ != 0){
                               // The second stage jumps directly to one of the third stage iterations and
                               // returns here if successful. Deflate the polynomial, store the zero or
                               // zeros, and return to the main algorithm.
                               j = degPar.Degree - N;
                               zeror[j] = Fxshfr_Par.szr;
                               zeroi[j] = Fxshfr_Par.szi;
                               NN = NN - Fxshfr_Par.NZ;
                               N = NN - 1;
                               for (var i = 0; i < NN; i++) p[i] = qp[i];
                               if (Fxshfr_Par.NZ != 1){
                                   zeror[j + 1] = Fxshfr_Par.lzr;
                                   zeroi[j + 1] = Fxshfr_Par.lzi;
                               }
                               break;
                           } 
                           else { 
                             // If the iteration is unsuccessful, another quadratic is chosen after restoring K
                             for (var i = 0; i < N; i++) { K[i] = temp[i]; }
                           } 
                       } 
                       // Return with failure if no convergence with 20 shifts
                       if (jj > 20) {
                           degPar.Degree -= N;
                           break;
                       } 
                   }
                   // >>>>> End Main Loop <<<<<
                   return;
               }
                //--> End Jenkins-Traub
                rpSolve(degreePar, p, zeror, zeroi);

                var l = zeroi.length;
                //format the output
                for( i=0; i<l; i++ ) {
                    // We round the imaginary part to avoid having something crazy like 5.67e-16.
                    var img = round( zeroi[i], decp+8 ),
                        real = round( zeror[i], decp );
                    // Did the rounding pay off? If the rounding did nothing more than chop off a few digits then no.
                    // If the rounding results in a a number at least 3 digits shorter we'll keep it else we'll keep 
                    // the original otherwise the rounding was worth it.
                    real = decp - String( real ).length > 2 ? real : zeror[i];
                    var sign = img < 0 ? '-' : '';

                    // Remove the zeroes
                    if( real === 0 ) { real = ''; }
                    if( img === 0 ) { img = ''; }

                    // Remove 1 as the multiplier and discard imaginary part if there isn't one.
                    img = Math.abs( img ) === 1 ? sign+'i' : ( img ? img+'*i' : '' );

                    var num = ( real && img ) ? real + '+' + img : real+img;
                    zeror[i] = num.replace(/\+\-/g, '-');
                }
                return zeror;
            } 
         },
        factor: function(symbol) {
            var retval = symbol,
                group = symbol.group,
                isCompositionGroup = function(group) {
                    return (group === PL || group === CP);
                };

            if(isCompositionGroup(group)) {
                //distribute the multiplier in sub-symbols
                for(var x in symbol.symbols) symbol.symbols[x].distributeMultiplier(); 
                //factor the multiplier
                var gcf = Math2.GCD.apply(undefined, symbol.coeffs()),
                        
                    factorize = function(symbol) { 
                        for(var x in symbol.symbols) {
                            var sub = symbol.symbols[x]; 
                            if(isCompositionGroup(sub.group)) {
                                factorize(sub);
                            }
                            else {
                                sub.multiplier /= gcf;
                            }
                        }
                    };

                factorize(symbol);
                symbol.multiplier *= gcf;

                if(group === PL) {
                    var powers = keys(symbol.symbols),
                        lowest_power = core.Utils.arrayMin(powers),
                        factor = _.parse(symbol.value+'^'+lowest_power);
                    var factored = new core.Symbol(0);
                    for(var x in symbol.symbols) {
                        factored = _.add(factored, _.divide(symbol.symbols[x], factor.copy()));
                    }

                    factored = _.symfunction(core.PARENTHESIS, [factored]);//place it parenthesis
                    factored.power *= symbol.power;
                    factored.multiplier *= symbol.multiplier;
                    factor.power *= symbol.power;

                    retval = _.multiply(factor, factored);
                }
                else if(group === CP) { 
                    try{
                        var roots = core.Utils.arrayUnique(core.Algebra.proots(symbol)),
                            all_ints = true; 
                        for(var i=0; i<roots.length; i++) {
                            if(!isInt(roots[i])) all_ints = false;
                        }
                        var result = new Symbol(1);
                        if(all_ints)  {
                            roots.map(function(root) {
                                result = _.multiply(result, 
                                    _.symfunction(core.PARENTHESIS, 
                                    [_.subtract(new Symbol(variables(symbol)[0]), new Symbol(root))]));
                            });
                            result.multiplier *= symbol.multiplier;
                            retval = result;
                        }
                    }
                    catch(e) {
                        try {
                            //not a polynomial. No biggie. Let's see if we can extract a few variables
                            var symbols = symbol.collectSymbols(),
                                num_symbols = symbol.length,
                                hash_table = {};
                            for(var i=0; i<num_symbols; i++) {
                                var cur_symbol = symbols[i], //collect all the variables contained in the symbol
                                    num_vars = vars.length;
                                for(var j=0; j<num_vars; j++) {
                                    var var_name = vars[j],
                                        variable = cur_symbol.value === var_name ? cur_symbol : cur_symbol.symbols[var_name],
                                        var_record = hash_table[var_name];
                                    if(isSymbol(variable.power)) throw new Error('Cannot factor symbol. Exiting');
                                    if(!var_record) hash_table[var_name] = [1, variable.power];
                                    else {
                                        var_record[0]++;
                                        var p = variable.power;
                                        if(p < var_record[1]) var_record[1] = p;
                                    }
                                }
                            }
                            var factor = [];
                            //we now know which variables we have and to which power so we can start reducing
                            for(var x in hash_table) {
                                var_record = hash_table[x];
                                //if we have as many recorded as there were sub-symbols then we can divide all of them
                                //by that symbol
                                if(var_record[0] === num_symbols) { 
                                    factor.push(x+'^'+var_record[1]);
                                }
                            };
                            
                            //we can now divide each one by that factor
                            factor = _.parse(factor.join('*'));//make it a Symbol
                            for(x in symbol.symbols) {
                                symbol.symbols[x] = _.divide(symbol.symbols[x], factor.copy());
                            }
                            
                            retval = _.multiply(_.parse(symbol.text()), factor);
                        }
                        catch(e){;}
                            
                    }
                }
            }
            
            if(retval.group === core.groups.FN) retval.updateHash();
            
            return retval;
        },
        expand: function (symbol) { 
            var is_composite = isComposite(symbol);

            function powerExpand(symbol) {
                if(!isComposite(symbol)) return symbol; //nothing to do here

                var p = symbol.power,
                    n = Math.abs(p); //store the power
                if(isInt(p) && n !== 1) { 
                    var sign = p / n,
                        multiplier = symbol.multiplier;//store the multiplier
                    n--; //iterations should be n-1 times
                    symbol.power = 1;
                    symbol.multiplier = 1;
                    var result = symbol.copy();
                    for(var i=0; i<n; i++) { 
                        result = polyExpand(result, i === n ? symbol : symbol.copy());
                    }
                    result.multiplier = multiplier;
                    if(result.power) result.power *= sign;
                    symbol = result;
               }

               return symbol;  
            }

            function polyExpand(symbol1, symbol2) { 
                var result = new Symbol(0),
                    s1_is_comp = isComposite(symbol1),
                    s2_is_comp = isComposite(symbol2);

                if(!s1_is_comp && s2_is_comp || symbol1.power < 0 && !(symbol2.power < 0)) { 
                    var t = symbol2; symbol2 = symbol1; symbol1 = t; //swap
                    //reuse t and also swap bools
                    t = s2_is_comp; s2_is_comp = s1_is_comp; s1_is_comp = t;
                }
                var result = new Symbol(0),
                    //make sure that their both positive or both negative
                    same_sign = core.Utils.sameSign(symbol1.power, symbol2.power);
                if(s1_is_comp) {
                    for(var x in symbol1.symbols) {
                        var symbolx = symbol1.symbols[x];
                        if(s2_is_comp  && same_sign) {
                            for(var y in symbol2.symbols) {
                                var symboly = symbol2.symbols[y],
                                    expanded;
                                if(isComposite(symbolx) || isComposite(symboly)) {
                                    expanded = polyExpand(symbolx.copy(), symboly.copy());
                                }
                                else {
                                    expanded = _.multiply(symbolx.copy(), symboly.copy());
                                }
                                result = _.add(result, expanded);
                            }
                        }
                        else {
                            result = _.add(result, _.multiply(symbolx.copy(), symbol2.copy()));
                        }
                    }
                }
                else {
                    result = _.multiply(symbol1, symbol2);
                }
                
                return result;
            }
            symbol = powerExpand(symbol); 

            if(symbol.symbols && symbol.group !== core.groups.EX) { 
                //there is no way to know if one of the symbols contained within
                //the CB is a composite so unfortunately we have to loop over each one of them.
                var symbols = symbol.collectSymbols(),
                    l = symbols.length;
                for(var i=0; i<l-1; i++) { 
                    var symbol1 = powerExpand(symbols.pop()),
                        symbol2 = powerExpand(symbols.pop());
                    var expanded = !is_composite ? polyExpand(symbol1, symbol2) : _.add(symbol1, symbol2.copy());
                    symbols.push(expanded);
                }

                var expanded_symbol = symbols[0];
                if(expanded_symbol) {
                    expanded_symbol.multiplier *= symbol.multiplier;
                    if(expanded_symbol.group !== core.groups.N) {
                        expanded_symbol.distributeMultiplier();
                        expanded.power *= symbol.power;
                    }
                        
                    symbol = expanded_symbol;
                    //put back the sign
                }
            }
            else if(symbol.args) {
                symbol.args[0] = __.expand(symbol.args[0]);
                if(symbol.group === core.groups.FN) symbol.updateHash();
            }
            else if(symbol.group === core.groups.EX) {
                symbol.power = __.expand(symbol.power);
            }
            
            return symbol;
        },
        poly2Arrays: function(symbol, sort) {
            var self = this; 
            if(!symbol.isPoly()) throw new Error('Polynomial Expected! Received '+core.Utils.text(symbol));
            var c = [];
                if(Math.abs(symbol.power) !== 1) symbol = core.Algebra.expand(symbol);

                if(symbol.group === core.groups.N) {c.push([symbol.multiplier, 0]); }
                else if(symbol.group === core.groups.S) { c.push([symbol.multiplier, symbol.power]); }
                else {
                    for(var x in symbol.symbols) {
                        if(core.Utils.isSymbol(p)) throw new Error('power cannot be a Symbol');
                        var sub = symbol.symbols[x],
                            p = sub.power; 
                        if(sub.symbols){
                            c.push.apply(c, self.poly2Arrays(sub));
                        }
                        else {
                            c.push([sub.multiplier, p||0]);
                        }
                    }
                }

                if(sort) { 
                    c = c.sort(function(a, b) { return (a[1] > b[1]); }); 
                }

                return c;
        },
        zeroPolynomial: function(a) {
            return (a[0] === 0 && a[1] === 0);
        },
        polyArrayCopy: function(poly_array) {
            return poly_array.map(function(x) {
                return x.slice(0);
            });
        },
        polyfill: function(arr) {
            //if the first power isn't zero make it so
            if(arr[0][1] !== 0) arr.unshift([0,0]);
            var n = arr.length-1,
                o = [],
                last;
            for(var i=0; i<n; i++) {
                last = arr.pop();
                o.push(last);
                var last_pow = last[1],
                    next_pow = arr[n-(i+1)][1],
                    gap = (last_pow-next_pow)-1;
                for(var j=0; j<gap; j++) { 
                    o.push([0,last_pow-(j+1)]);
                }
            }
            o.push(arr[0]);
            return o;
        },
        polyArrayDiv: function(dividend, divisor) { 
            var max_pow_div = divisor[0][1],//the maximum divisor power
                coeff_div = divisor[0][0],
                dl = divisor.length,
                curpos = 0, //the walker along the numerator;
                top = [];
            //while the difference of the powers is greater than zero
            do {
                var max_pow_num = dividend[curpos][1], //the current maximum power
                    //the ratio of the first coefficients which will be used to adjust out the divisor
                    mratio = dividend[curpos][0]/coeff_div, 
                    pow_difference = max_pow_num-max_pow_div;//the difference in maximum powers
                if(pow_difference < 0) break; //out of bounds check <<<
                //place the symbol on the top
                top.push([mratio, pow_difference]);
                //start at the current cursor position
                for(var i=0; i<dl; i++) {
                    var div_i = curpos+i,
                        cur_sym_den = divisor[i]; //current working symbol in denominator
                    //adjust the dividend coeff
                    dividend[div_i][0] -= cur_sym_den[0]*mratio;
                }
                curpos++;
            }
            while(pow_difference > 0);

            //filter the results
            var remainder = [],
                rl = dividend.length;
            for(i=0; i<rl; i++) {
                var p = dividend[i];
                if(p[0] !== 0) remainder.push(p);
            };
            if(top[0] === undefined) top.push([0,0]);
            if(remainder[0] === undefined) remainder.push([0,0]);
            return [top, remainder];
        },
        polyArrayCoeffs: function(a, all) { 
            var c = [],
                l = a.length;
            for(var i=0; i<l; i++) {
                var coeff = a[i][0];
                if(coeff !== 0 || all) c.push(coeff);
            }
            return c;
        },
        polydiv: function(symbol, asArray) { 
            //A numerator and a denominator is expected. The symbol must therefore be of group CB
            if(symbol.group === core.groups.CB) {
                var symbols = symbol.collectSymbols(),
                    n = symbols.length,
                    variable = core.Utils.variables(symbol)[0],   
                    num, denom;
                for(var i=0; i<n; i++) { 
                    if(symbols[i].power < 0) {
                        denom = core.Utils.remove(symbols, i);
                        break;
                    }
                }
                //A try catch block is used since if either the denominator or the numerator is not a polynomial
                //or if the symbol does not contain a denominator the an error is thrown and the symbol is 
                //returned;
                try{
                    //if there's no denominator then an error is thrown and goodbye.
                    if(n-- > 2) {
                        for(i=0; i<n; i++) {
                            symbols[i] = '('+symbols[i].text()+')';
                        }
                        //it's easier just to parse it back to symbol than to salvage the existing symbols
                        num = _.parse(symbols.join('*')); 
                    }
                    else {
                        num = symbols[0];
                    }

                    //collect the coefficients and powers and sort them by powers, ascending
                    var divisor;
                    if(denom.group === core.groups.S && denom.value === variable) {
                        divisor = [[symbol.multiplier, symbol.power]];
                    }
                    else {
                        divisor = core.Algebra.poly2Arrays(denom, true);
                    }
                    var dividend = core.Algebra.poly2Arrays(num, true);
                    //fill the gaps
                    dividend = core.Algebra.polyfill(dividend);
                    divisor = core.Algebra.polyfill(divisor);

                    var result = core.Algebra.polyArrayDiv(dividend, divisor),
                        top = result[0],
                        remainder = result[1];

                    if(!asArray) {
                        var stringify = function(a) {
                                return a.map(function(item){
                                    return item[0]+'*'+variable+'^'+item[1];
                                }).join('+');
                            };
                        remainder = _.parse(stringify(remainder));
                        top = _.parse(stringify(top));
                    }
                    return [top, remainder];
                }
                catch(e) {;}  
            }
            return symbol;
        },
        polyArrayGCD: function(parr1, parr2) {
            var max_pow_arr1 = parr1[0][1],
                max_pow_arr2 = parr2[0][1];

            if(max_pow_arr1 === max_pow_arr2 && parr1.length === 1 && parr2.length === 1) {
                return [[core.Math2.GCD(parr1[0][0], parr2[0][0]), max_pow_arr1]];
            }

            //get a common gcd amongst the coefficients
            var gcd = core.Math2.GCD.apply(undefined, __.polyArrayCoeffs(parr1).concat(__.polyArrayCoeffs(parr2)));
            if(gcd !== 1) {
                var gcd_divide = function(a) {
                    a[0] = a[0]/gcd;
                    return a;
                };
                parr1 = parr1.map(gcd_divide);
                parr2 = parr2.map(gcd_divide);
            };

            if(max_pow_arr2 > max_pow_arr1) {
                var t = parr2; parr2 = parr1; parr1 = t; //swap it all
            }
            var dividend = parr1,
                divisor = parr2,
                remainder,result;
            do {
                result = __.polyArrayDiv(__.polyArrayCopy(dividend), __.polyArrayCopy(divisor));
                remainder = result[1];
                dividend = divisor;
                divisor = remainder;
            }
            while(!(remainder[0][0] === 0 && remainder[0][1] === 0));
            //factor
            var retval = dividend,
                l = retval.length;

            var coeff_gcd = core.Math2.GCD.apply(undefined, __.polyArrayCoeffs(retval))/gcd;

            if(coeff_gcd !== 1) {
                for(i=0; i<l; i++) { retval[i][0] /= coeff_gcd; }
            }

            return retval;
        },
        polyGCD: function() { 
            var polyArrayGCD = core.Algebra.polyArrayGCD,
                n = arguments.length,
                curpos = 0,
                p1 = __.poly2Arrays(arguments[curpos]);
            while(n > ++curpos) { 
                //send in the smallest possible value
                var p2 = __.poly2Arrays(arguments[curpos]);
                p1 = polyArrayGCD(__.polyfill(p1),p2 = __.polyfill(p2));
            }
            return p1;
        }
    };
    
    nerdamer.register([
        {
            /*
            * Other than the preparation of the coefficients, 
            * this function is Mr. David Binner's javascript port of the Jenkins-Traub algorithm.
            * The original source code can be found here http://www.akiti.ca/PolyRootRe.html.
            */    
            name: 'proots',
            visible: true,
            numargs: [1,2],
            build: function() { return __.proots; }
        },
        {
            name: 'factor',
            visible: true,
            numargs: 1,
            build: function() { return __.factor; }
        },
        {
            name: 'expand',
            visible: true,
            numargs: 1,
            warnings: 'unoptimized, slow',
            build: function() { return __.expand; }
        },
        {
            name: 'polyGCD',
            visible: true,
            numargs: -1,
            build: function() { return __.polyGCD; }
        }
    ]);
})();

/*
* Author : Martin Donk
* Website : http://www.nerdamer.com
* Email : martin.r.donk@gmail.com
* License : http://opensource.org/licenses/LGPL-3.0
* Source : https://github.com/jiggzson/nerdamer
*/
(function() {
    var core = nerdamer.getCore(),
        _ = core.PARSER,
        isSymbol = core.Utils.isSymbol,
        FN = core.groups.FN,
        Symbol = core.Symbol,
        text = core.Utils.text,
        inBrackets = core.Utils.inBrackets,
        N = core.groups. N,
        S = core.groups.S,
        FN = core.groups.FN,
        PL = core.groups.PL,
        CP = core.groups.CP,
        CB = core.groups.CB,
        EX = core.groups.EX;
    var __ = core.Calculus = {
        version: '1.0.0',
        sum: function(fn, index, start, end) {
            if(!(index.group === core.groups.S)) throw new Error('Index must be symbol. '+text(index)+' provided');
            index = index.value;
            var retval;
            if(core.Utils.isNumericSymbol(start) && core.Utils.isNumericSymbol(end)) {
                start = start.multiplier;
                end = end.multiplier;

                var variables = core.Utils.variables(fn);
                if(variables.length === 1 && index === variables[0]) {
                    var f = core.Utils.build(fn);
                    retval = 0;
                    for(var i=start; i<=end; i++) {
                        retval += f.call(undefined, i);
                    }
                }
                else {
                    var f = fn.text(),
                        subs = {'~': true}, //lock subs
                    retval = new core.Symbol(0);

                    for(var i=start; i<=end; i++) {
                        subs[index] = new Symbol(i); 
                        retval = _.add(retval, _.parse(f, subs)); //verrrrryyy sllloooowww
                    }
                }
            }
            else {
                retval = _.symfunction('sum',arguments);
            }

            return retval;
        },
        diff: function(symbol, wrt) {
            var d = isSymbol(wrt) ? wrt.text() : wrt; 
            
            if(d === undefined) d = core.Utils.variables(symbol)[0];

            if(symbol.group === FN && !isSymbol(symbol.power)) {
                var a = derive(symbol);
                var b = __.diff(symbol.args[0].copy(), d); 
                symbol = _.multiply(a, b);//chain rule
            }
            else {
                symbol = derive(symbol);
            }
            
            return symbol;
            
             // Equivalent to "derivative of the outside".
            function polydiff(symbol) { 
                if(symbol.value === d || symbol.contains(d, true)) { 
                    symbol.multiplier *= symbol.power;
                    symbol.power -= 1; 
                    if(symbol.power === 0) {
                        symbol = Symbol(symbol.multiplier);
                    }
                } 
                return symbol;
            };
            function derive(symbol) { 
                var g = symbol.group, t, a, b, cp; 

                if(g === N || g === S && symbol.value !== d) { 
                    symbol = Symbol(0);
                }
                else if(g === S) {  
                    symbol = polydiff(symbol);
                }
                else if(g === CB) { 
                    var m = symbol.multiplier;
                    symbol.multiplier = 1;
                    var retval =  _.multiply(product_rule(symbol),polydiff(symbol.copy()));
                    retval.multiplier *= m;
                    return retval;
                }
                else if(g === FN && symbol.power === 1) {
                    // Table of known derivatives
                    switch(symbol.baseName) {
                        case 'log':
                            cp = symbol.copy();
                            symbol = symbol.args[0].copy();//get the arguments

                            if( isSymbol( symbol.power ) ) {
                                symbol.power = _.multiply(symbol.power, Symbol(-1));
                            }
                            else {
                                symbol.power *= -1;
                            }
                            symbol.multiplier = cp.multiplier/symbol.multiplier; 
                            break;
                        case 'cos':
                            symbol.baseName = 'sin';
                            symbol.multiplier *= -1;
                            break;
                        case 'sin': 
                            symbol.baseName = 'cos';
                            break;
                        case 'tan':
                            symbol.baseName = 'sec';
                            symbol.power = 2;
                            break;
                        case 'sec': 
                            // Use a copy if this gives errors
                            symbol = qdiff(symbol, 'tan');
                            break;
                        case 'csc':
                            symbol = qdiff(symbol, '-cot');
                            break;
                        case 'cot':
                            symbol.baseName = 'csc';
                            symbol.multiplier *= -1;
                            symbol.power = 2;
                            break;
                        case 'asin':
                            symbol = _.parse('(sqrt(1-('+text(symbol.args[0])+')^2))^(-1)');
                            break;
                        case 'acos':
                            symbol = _.parse('-(sqrt(1-('+text(symbol.args[0])+')^2))^(-1)');
                            break;
                        case 'atan':
                            symbol = _.parse('(1+('+text(symbol.args[0])+')^2)^(-1)');
                            break;
                        case 'abs':
                            m = symbol.multiplier; 
                            symbol.multiplier = 1;
                            //depending on the complexity of the symbol it's easier to just parse it into a new symbol
                            //this should really be readdressed soon
                            b = symbol.args[0].copy();
                            b.multiplier = 1;
                            symbol = _.parse(inBrackets(text(symbol.args[0]))+'/abs'+inBrackets(text(b)));
                            symbol.multiplier = m;
                            break;
                        case 'parens':
                            symbol = Symbol(1);
                            break;
                    }
                }
                else if(g === EX || g === FN && isSymbol(symbol.power)) { 
                    var value;
                    if(g === EX) {
                        value = symbol.value;
                    }
                    else if(g === FN && symbol.contains(d)) { 
                        value = symbol.baseName + inBrackets(text(symbol.args[0]));
                    }
                    else {
                        value = symbol.value + inBrackets(text(symbol.args[0]));
                    }
                        a = _.multiply(_.parse('log'+inBrackets(value)), symbol.power.copy()); 
                        b = __.diff(_.multiply(_.parse('log'+inBrackets(value)), symbol.power.copy()), d); 
                    symbol = _.multiply(symbol, b);
                }
                else if( g === FN && symbol.power !== 1 ) { 
                    b = symbol.copy();
                    //turn b into a vanilla powerless, multiplier-less symbol
                    b.power = 1; 
                    b.multiplier = 1;
                    symbol = _.multiply(polydiff( symbol.copy(), d ), derive(b));  
                }
                else if( g === CP || g === PL ) { 
                    var result = new Symbol(0);
                    for(var x in symbol.symbols) {
                        result = _.add(result, __.diff(symbol.symbols[x].copy(), d));
                    }
                    symbol = _.multiply(polydiff(symbol.copy()), result);
                }
                symbol.updateHash();
                return symbol;
            };

            function qdiff(symbol, val, altVal) {
                return _.multiply(symbol, _.parse(val+inBrackets(altVal || text(symbol.args[0]))));
            };

            function product_rule(symbol) { 
                //grab all the symbols within the CB symbol
                var symbols = symbol.collectSymbols(), 
                    result = new Symbol(0),
                    l = symbols.length;
                //loop over all the symbols
                for(var i=0; i<l; i++) {
                    var df = __.diff(symbols[i].copy(), d);
                    for(var j=0; j<l; j++) {
                        //skip the symbol of which we just pulled the derivative
                        if(i !== j) {
                            //multiply out the remaining symbols
                            df = _.multiply(df, symbols[j].copy());
                        }
                    }
                    //add the derivative to the resutl
                    result = _.add(result, df);
                }
                return result; //done
            };
        }
    };
    
    nerdamer.register([
        {
            name: 'diff',
            visible: true,
            numargs: [1,2],
            build: function(){ return __.diff; }
        },
        {
            name: 'sum',
            visible: true,
            numargs: 4,
            build: function(){ return __.sum; }
        }
    ]);
})();