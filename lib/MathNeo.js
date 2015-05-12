/*
 *  /MathNeo.js
 *
 *  Copyright (c) 2009-2015 The MathJax Consortium
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */


/*
* Author : Italo Ayres
* Email : italoayres@gmail.com
* Source : https://github.com/italoayres/MathNeo.js
*/
var MathNeo = {
    /** Int: Maximum Number of Iterations Before Stopping**/
    maxIter: 100,
    /** Boolean: Enable Logging**/
    verbose: false,
    /** 
    *   input:
    *       f:  string f(x)
    *       x0: value inside the interval where the function root is.
    *       t:  tolerance
    *       m:  Maximum Iterations loop (Optional)
    *   output:
    *       json list of objects representing each interaction:
    *       {n,Xn,f(Xn),f'(Xn),error} *
    **/
    newton: function(f, x0, t, m) {
        var output = [];
        var f = nerdamer(f);
        var df = nerdamer('diff(x)', {x:f});
        var e, xn = x0;
        if(this.verbose)console.log("f(x)=",f.text(),"  f'(x)=", df.text());;

        for(i=0; e>t || i<=1; i++) {
            var a = nerdamer(f).evaluate({x: xn});    // f(x)
            var b = nerdamer(df).evaluate({x: xn});   // f'(x)
            var xn1 = xn - (a/b);                       // Xn+1
            if (i) {
                e = Math.abs(xn1-xn);
                xn = xn1;
            }
            if(this.verbose)console.log(i, xn, a.text(), b.text(), e);
            output.push({
                n: i,
                xn: xn,
                fx: a.text(),
                dfx: b.text(),
                e: e            
            });

            // If Maximun Iterations Reached
            if(i>m || i>this.maxIter) { output.m = true; break; }
        }
        return output;
    },

    /**
    *   input:
    *       f:      string f(x)
    *       [a,b]   interval where the function root is.
    *       t:      tolerance
    *   output:
    *       json list of objects representing each interaction:
    *       {a,b,m,signal(f(m)),error} *
    *
    **/
    bissection: function(f, a0, b0, t) {

        var output = [];
        var f = nerdamer(f);    
        var e = 1000, m, a=a0, b=b0;
        if(this.verbose)console.log("f(x)=",f.text());

        while(e>t) {
            m = (a+b)/2;
            e = Math.abs(b-a);        

            // Evaluate f(x) for a, b, m
            var fa = nerdamer(f).evaluate({x: a}).text();
            var fb = nerdamer(f).evaluate({x: b}).text();
            var fm = nerdamer(f).evaluate({x: m}).text();

            if (fm=='0' || e<t) {
                if(this.verbose)console.log(m);
                output.push({m: m});
                break;
            } 

            // Function Signals
            var sa = parseFloat(fa)>0;
            var sb = parseFloat(fa)>0;
            var sm = parseFloat(fm)>0;        

            if(this.verbose)console.log(a, b, m, sm?'+':'-', e);
            output.push({
                a: a, 
                b: b, 
                m: m, 
                s: sm?'+':'-', 
                e: e           
            });

            // Decides next iteration inputs
            (sa == sm) ? a=m : b=m;
        }
        return output;
    },
    
    /**
    *   Receives a string input and evaluates using Nerdamer Solver.
    *   It separates the "arguments" marked by '|' and
    *   evaluate using the proper formula for Equations, Expressions, or Linear Systems
    **/
    solve: function(args) {
        
        var ans;
        console.log(args);
        /* Options:
        *   1 argument: evaluate() 
        *   2 arguments, 1st argument dont have '=': arg1.evaluate(arg2)
        *   2 arguments, 1st is equation: solveEquations(arg1,arg2)
        *   n arguments, all are equations: solveEquations([arg1, arg2,..,argN]) 
        */
        
    
        try {
            
            // Simple Expression
            if(args.length == 1) {
                ans = nerdamer(args[0]).evaluate().text();
            // Expression with known value
            } else if (args.length == 2 && args[0].indexOf("=") == -1) {
                // args[1] == "x:1,y:3", "x:1"
                var a = '';
                var pairs = args[1].split(',');
                
                for(i in pairs) {
                    var term = pairs[i].split('=')[0].trim();
                    var value = pairs[i].split('=')[1].trim();
                    a+='"'+term+'":'+value;
                    if(i < pairs.length-1)
                        a+=',';
                }
                console.log(a);
                
                args[1] = JSON.parse('{'+a+'}');
                ans = nerdamer(args[0]).evaluate(args[1]).text();
            // Equation 
            } else if (args.length == 2 && args[0].indexOf("=") > -1) {
                ans = nerdamer.solveEquations(args[0], args[1].trim()).toString();
            // Linear Equation or Error
            } else {
                for(i in args) {
                    if(args[i].indexOf("=") == -1)
                        break;
                    // If continues, all arguments are equations      
                    if (i == args.length-1) {
                        a = nerdamer.solveEquations(args);
                        ans = JSON.stringify(a);                        
                    }
                }
                             
            }
            
        } catch(e) {
            ans = e;
        } finally {            
            return ans;
        }
    }
}

