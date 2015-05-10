# MathNeo.js :: Math - Not Even Once

A Simple Javascript Library to find aproximate roots of functions
using numerical methods like Newton's Method, Bissection and others.

Usage Exemples:

Newton's Method

Input:

    f:  string f(x)
    x0: value inside the interval where the function root is.
    t:  tolerance
    m:  Maximum Iterations loop (Optional)
    
Output: json list of objects representing each interaction:

    [{n,Xn,f(Xn),f'(Xn),error}]

Find the aproximate root of: 

    f(x)= x^4-4x^2+7x-11 

with X0 = 1.5 and error < 0.0001

    newton('x^4-4x^2+7x-11', 1.5, 0.00001)

Result:
    
    [
        { "n":0, "xn":1.5, "fx":"-4.4375", "dfx":"8.5" },
        { "n":1, "xn":2.0220588235294117, "fx":"-4.4375", "dfx":"8.5", "e":0.5220588235294117 },
        { "n":2, "xn":1.8748603646257371, "fx":"3.5171708809807196","dfx":"23.894074076429877","e":0.14719845890367456},
        { "n":3, "xn":1.8520118022704795, "fx":"0.419554764798443","dfx":"18.362414154337348","e":0.022848562355257673},
        { "n":4, "xn":1.8515097261420388, "fx":"0.008833085669570195","dfx":"17.59312018478855","e":0.000502076128440665},
        { "n":5, "xn":1.8515094884108367, "fx":"0.000004178477064797903","dfx":"17.576477257142663","e":2.3773120205738962e-7}
    ]