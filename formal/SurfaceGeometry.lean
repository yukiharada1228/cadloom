import Cadloom

namespace Cadloom

/-- Unnormalized circular-cylinder implicit equation, q measured from an axis point. -/
def cylinderForm3 {K : Type*} [CommRing K] (dx dy dz x y z radiusSquared : K) : K :=
  (dy*z-dz*y)^2+(dz*x-dx*z)^2+(dx*y-dy*x)^2-
    radiusSquared*(dx^2+dy^2+dz^2)

/-- Lagrange identity relates the implemented cross-product form to axis distance. -/
theorem cylinder_projection_identity {K : Type*} [CommRing K] (dx dy dz x y z r : K) :
    cylinderForm3 dx dy dz x y z r =
      (dx^2+dy^2+dz^2)*(x^2+y^2+z^2)-(dx*x+dy*y+dz*z)^2-
      r*(dx^2+dy^2+dz^2) := by
  unfold cylinderForm3
  ring

/-- Moving the chosen axis origin along the same axis preserves the equation. -/
theorem cylinder_axis_shift {K : Type*} [CommRing K] (dx dy dz x y z r s : K) :
    cylinderForm3 dx dy dz (x+s*dx) (y+s*dy) (z+s*dz) r =
      cylinderForm3 dx dy dz x y z r := by
  unfold cylinderForm3
  ring

/-- Rescaling multiplies the equation by the square of the scale. -/
theorem cylinder_axis_scale {K : Type*} [CommRing K] (dx dy dz x y z r s : K) :
    cylinderForm3 (s*dx) (s*dy) (s*dz) x y z r =
      s^2*cylinderForm3 dx dy dz x y z r := by
  unfold cylinderForm3
  ring

/-- Coefficients of the implemented line/cylinder intersection polynomial. -/
theorem line_cylinder_polynomial {K : Type*} [CommRing K]
    (dx dy dz x y z vx vy vz r t : K) :
    cylinderForm3 dx dy dz (x+t*vx) (y+t*vy) (z+t*vz) r =
      ((dy*vz-dz*vy)^2+(dz*vx-dx*vz)^2+(dx*vy-dy*vx)^2)*t^2+
      2*((dy*z-dz*y)*(dy*vz-dz*vy)+(dz*x-dx*z)*(dz*vx-dx*vz)+
        (dx*y-dy*x)*(dx*vy-dy*vx))*t+
      cylinderForm3 dx dy dz x y z r := by
  unfold cylinderForm3
  ring

/-- The implemented radial normal is exactly perpendicular to the axis. -/
theorem cylinder_normal_perpendicular {K : Type*} [CommRing K] (dx dy dz x y z : K) :
    let D := dx^2+dy^2+dz^2
    let along := dx*x+dy*y+dz*z
    dx*(D*x-dx*along)+dy*(D*y-dy*along)+dz*(D*z-dz*along)=0 := by
  dsimp
  ring

/-- On a regular cylinder the normal has squared norm r*D². -/
theorem cylinder_normal_squared {K : Type*} [CommRing K] (dx dy dz x y z r : K)
    (h : cylinderForm3 dx dy dz x y z r = 0) :
    let D := dx^2+dy^2+dz^2
    let along := dx*x+dy*y+dz*z
    (D*x-dx*along)^2+(D*y-dy*along)^2+(D*z-dz*along)^2=r*D^2 := by
  unfold cylinderForm3 at h
  dsimp
  linear_combination (dx^2+dy^2+dz^2)*h

/-- Spatial line substitution into a rational squared-radius sphere. -/
theorem line_sphere_polynomial {K : Type*} [CommRing K]
    (x y z vx vy vz r t : K) :
    (x+t*vx)^2+(y+t*vy)^2+(z+t*vz)^2-r =
      (vx^2+vy^2+vz^2)*t^2+2*(x*vx+y*vy+z*vz)*t+(x^2+y^2+z^2-r) := by
  ring

/-- Coefficients producing a point on two nonparallel rational planes. -/
theorem plane_gram_intersection {K : Type*} [Field K] (A B C k l : K)
    (h : A*B-C^2 ≠ 0) :
    let alpha := (k*B-l*C)/(A*B-C^2)
    let beta := (l*A-k*C)/(A*B-C^2)
    A*alpha+C*beta=k ∧ C*alpha+B*beta=l := by
  dsimp
  generalize hd : A*B-C^2 = determinant at *
  constructor <;> field_simp [h] <;> rw [← hd] <;> ring

/-- The basis u, n×u is positively oriented about n when n·u=0 and both are nonzero. -/
theorem circle_basis_orientation {K : Type*} [CommRing K] (nx ny nz ux uy uz : K) :
    nx*(uy*(nx*uy-ny*ux)-uz*(nz*ux-nx*uz))+
    ny*(uz*(ny*uz-nz*uy)-ux*(nx*uy-ny*ux))+
    nz*(ux*(nz*ux-nx*uz)-uy*(ny*uz-nz*uy)) =
      (nx^2+ny^2+nz^2)*(ux^2+uy^2+uz^2)-(nx*ux+ny*uy+nz*uz)^2 := by
  ring

end Cadloom
