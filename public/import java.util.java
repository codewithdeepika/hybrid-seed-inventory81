import java.util.Scanner;
import java.lang.Math;
import java.text.DecimalFormat;

public class Main {
    public static void main(String[] args) {

        Scanner scanner = new Scanner(System.in);

        float a, b, c;

        // Taking input for a, b, c
        a = scanner.nextFloat();
        b = scanner.nextFloat();
        c = scanner.nextFloat();

        scanner.close();

        float delta = b * b - 4 * a * c;

        DecimalFormat df = new DecimalFormat("0");  // To format output as integer without decimal

        if (delta > 0) {
            System.out.println("Real and Distinct");

            float root1 = (float)((-b - Math.sqrt(delta)) / (2 * a));
            float root2 = (float)((-b + Math.sqrt(delta)) / (2 * a));

            System.out.println(df.format(root1) + " " + df.format(root2));
        } else if (delta == 0) {
            System.out.println("Real and Equal");

            float root = -b / (2 * a);

            System.out.println(df.format(root) + " " + df.format(root));
        } else {
            System.out.println("Imaginary");
        }
    }
}
