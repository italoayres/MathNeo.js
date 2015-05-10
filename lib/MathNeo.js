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
    }
    
}
